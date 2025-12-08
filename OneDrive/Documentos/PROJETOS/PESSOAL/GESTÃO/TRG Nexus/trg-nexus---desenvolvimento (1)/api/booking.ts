import { VercelRequest, VercelResponse } from '@vercel/node';
import pg from 'pg';
import { sendBookingNotification } from './_utils/notifications';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { Pool } = pg;

    const envCheck = {
        hasUrl: !!process.env.POSTGRES_URL || !!process.env.trgnexus_POSTGRES_URL,
        nodeEnv: process.env.NODE_ENV,
    };

    try {
        let connectionString = process.env.trgnexus_POSTGRES_URL || process.env.POSTGRES_URL;

        if (connectionString && connectionString.includes('?sslmode=require')) {
            connectionString = connectionString.replace('?sslmode=require', '?');
        }

        if (!connectionString) {
            return res.status(500).json({ status: 'error', message: 'Missing Database URL', env: envCheck });
        }

        const pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
        });

        const client = await pool.connect();
        console.log('Connected to DB');

        try {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const { name, email, phone, date, time, therapistId, ...anamnesisData } = req.body || {};

            if (!name || !email || !date || !time) {
                console.error('Missing fields:', { name, email, date, time });
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Format anamnesis data for storage
            const anamnesisString = JSON.stringify(anamnesisData, null, 2);
            const mainComplaint = anamnesisData.queixaPrincipal || 'Não informado';

            // Fetch Therapist Details
            let therapistName = 'Terapeuta TRG';
            let therapistEmail = null;

            if (therapistId) {
                const therapistResult = await client.query(
                    'SELECT name, email FROM therapists WHERE id = $1',
                    [therapistId]
                );
                if (therapistResult.rows.length > 0) {
                    therapistName = therapistResult.rows[0].name;
                    therapistEmail = therapistResult.rows[0].email;
                }
            }

            await client.query('BEGIN');

            const patientCheck = await client.query('SELECT id FROM patients WHERE email = $1', [email]);
            let patientId;

            if (patientCheck.rows.length > 0) {
                patientId = patientCheck.rows[0].id;
                await client.query(
                    'UPDATE patients SET name = $1, phone = $2 WHERE id = $3',
                    [name, phone, patientId]
                );
            } else {
                const newPatient = await client.query(
                    `INSERT INTO patients (name, email, phone, status, notes, therapist_id)
             VALUES ($1, $2, $3, 'Ativo', $4, $5)
             RETURNING id`,
                    [name, email, phone, `Queixa Principal: ${mainComplaint}`, therapistId || null]
                );
                patientId = newPatient.rows[0].id;
            }

            // 2. Create Appointment
            await client.query(
                `INSERT INTO appointments (patient_id, date, time, status, type, notes, therapist_id)
           VALUES ($1, $2, $3, 'Agendado', 'Primeira Consulta', $4, $5)`,
                [
                    patientId,
                    date,
                    time,
                    anamnesisString,
                    therapistId || null
                ]
            );

            // 3. Create Notification for Therapist
            if (therapistId) {
                await client.query(
                    `INSERT INTO notifications (recipient_id, recipient_role, title, message, type)
                     VALUES ($1, 'therapist', $2, $3, 'info')`,
                    [
                        therapistId,
                        'Novo Agendamento',
                        `${name} agendou uma sessão para ${date} às ${time}.`
                    ]
                );
            }

            await client.query('COMMIT');

            // Send Notifications (Async - don't block response)
            let emailDebug = { status: 'skipped', error: null as any, info: null as any };
            try {
                // Get origin from request headers or default to production
                const requestOrigin = req.headers.origin || '';
                const origin = requestOrigin.includes('localhost') ? requestOrigin : 'https://traeegnimsqa.vercel.app';

                const result = await sendBookingNotification({
                    name,
                    email,
                    phone,
                    date,
                    time,
                    therapistName,
                    therapistEmail,
                    mainComplaint
                });
                emailDebug = result;
            } catch (notifyError) {
                console.error('Notification Error:', notifyError);
                emailDebug = { status: 'failed', error: notifyError, info: null };
            }

            res.status(200).json({ message: 'Booking confirmed', patientId, emailDebug });
        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error('Transaction Error:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
            await pool.end();
        }
    } catch (error: any) {
        console.error('Health DB Error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
}
