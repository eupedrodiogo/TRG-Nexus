import nodemailer from 'nodemailer';

interface BookingNotificationData {
    name: string;
    email: string;
    phone: string;
    date: string;
    time: string;
    therapistName?: string;
    therapistEmail?: string | null;
    mainComplaint?: string;
    location?: string;
}

export async function sendBookingNotification(data: BookingNotificationData) {
    console.log('Preparing to send notifications for:', data.email);
    let result = { status: 'pending', error: null, info: null };


    // 1. Email Notification
    try {
        // Check for SMTP credentials
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('SMTP credentials not found. Skipping email sending. (Check SMTP_HOST, SMTP_USER, SMTP_PASS)');
            result.status = 'skipped_no_credentials';
        } else {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            const mailOptions = {
                from: '"TRG Nexus" <noreply@trgnexus.com>',
                to: data.email,
                subject: 'Confirmação de Agendamento - TRG Nexus',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h2 style="color: #0f172a; margin: 0;">Agendamento Confirmado!</h2>
                        </div>
                        <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
                            <p>Olá, <strong>${data.name}</strong>,</p>
                            <p>Seu agendamento foi realizado com sucesso. Abaixo estão os detalhes da sua sessão:</p>
                            
                            <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Data:</strong> ${data.date}</p>
                                <p style="margin: 5px 0;"><strong>Horário:</strong> ${data.time}</p>
                                <p style="margin: 5px 0;"><strong>Terapeuta:</strong> ${data.therapistName || 'TRG Nexus'}</p>
                            </div>

                            <h3>Informações Importantes</h3>
                            <ul>
                                <li><strong>Cancelamento:</strong> Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência. Cancelamentos tardios podem estar sujeitos a uma taxa de 50% do valor da sessão.</li>
                                <li><strong>Pontualidade:</strong> Recomendamos entrar na sala de espera virtual 5 minutos antes do horário agendado.</li>
                                <li><strong>Ambiente:</strong> Escolha um local tranquilo, privado e com boa conexão de internet.</li>
                            </ul>

                            <p style="margin-top: 30px;">Se tiver dúvidas, entre em contato conosco pelo WhatsApp.</p>
                            
                            <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">
                                © ${new Date().getFullYear()} TRG Nexus. Todos os direitos reservados.
                            </p>
                        </div>
                    </div>
                `
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent:', info.messageId);
            result.status = 'sent';
            result.info = info as any;
        }
    } catch (error: any) {
        console.error('Error sending email:', error);
        result.status = 'error';
        result.error = error.message || error;
    }

    // 1.5. Therapist Email (New Appointment Alert)
    if (data.therapistEmail) {
        try {
            // Re-create transporter if needed or reuse if scoped higher (in this fn, we create it inside the try/catch block above, so we might need to restructure or create a new one. 
            // For simplicity and safety given the previous block structure, I'll create a new transporter check here or ideally verify if I can reuse.
            // Looking at the code, 'transporter' is scoped to the 'else' block of client email. 
            // Better to instantiate it once at the top if possible, or just repeat the creation for robust isolation.
            // Let's copy the creation logic for safety.

            if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: Number(process.env.SMTP_PORT) || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });

                const therapistHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <title>Novo Agendamento</title>
                    </head>
                    <body style="font-family: 'Segoe UI', sans-serif; background-color: #f8fafc; padding: 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
                            <div style="background-color: #3b82f6; padding: 24px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 22px;">📅 Novo Agendamento Recebido</h1>
                            </div>
                            <div style="padding: 32px;">
                                <p style="color: #334155; font-size: 16px;">Olá, <strong>${data.therapistName || 'Terapeuta'}</strong>!</p>
                                <p style="color: #334155;">Você tem um novo agendamento confirmado na sua agenda.</p>
                                
                                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0;">
                                    <p style="margin: 0 0 8px 0;"><strong>Cliente:</strong> ${data.name}</p>
                                    <p style="margin: 0 0 8px 0;"><strong>Data:</strong> ${data.date}</p>
                                    <p style="margin: 0 0 8px 0;"><strong>Horário:</strong> ${data.time}</p>
                                    <p style="margin: 0 0 8px 0;"><strong>Telefone:</strong> ${data.phone}</p>
                                    <p style="margin: 0;"><strong>Queixa:</strong> ${data.mainComplaint || 'Não informada'}</p>
                                </div>

                                <div style="text-align: center; margin-top: 32px;">
                                    <a href="https://trg-nexus.vercel.app/dashboard" style="background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                        Ver na Minha Agenda
                                    </a>
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await transporter.sendMail({
                    from: '"TRG Nexus System" <noreply@trgnexus.com>',
                    to: data.therapistEmail,
                    subject: `📅 Novo Agendamento: ${data.name}`,
                    html: therapistHtml
                });
                console.log('Therapist email sent.');
            }
        } catch (error) {
            console.error('Error sending therapist email:', error);
        }
    }

    // 2. WhatsApp Notification (Automatic via API)
    try {
        const whatsappApiUrl = process.env.WHATSAPP_API_URL;
        const whatsappToken = process.env.WHATSAPP_API_TOKEN;

        if (whatsappApiUrl) {
            console.log('Sending automatic WhatsApp message to:', data.phone);

            // Format phone number
            let cleanPhone = data.phone.replace(/\D/g, '');
            if (cleanPhone.length <= 11) {
                cleanPhone = '55' + cleanPhone;
            }

            const message = `Olá ${data.name}, seu agendamento na TRG Nexus está confirmado! ✅\n\n📅 Data: ${data.date}\n⏰ Horário: ${data.time}\n👨‍⚕️ Terapeuta: ${data.therapistName || 'Especialista TRG'}\n\nRecomendamos entrar 5 minutos antes. Em caso de dúvidas, responda esta mensagem.`;

            const payload = {
                phone: cleanPhone,
                message: message,
                number: cleanPhone,
                text: message
            };

            const response = await fetch(whatsappApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${whatsappToken}`,
                    'Client-Token': whatsappToken || ''
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('WhatsApp message sent successfully!');
            } else {
                const errText = await response.text();
                // Avoid logging full tokens if possible, but status and error text are useful
                console.error('Failed to send WhatsApp:', response.status, errText);
            }
        } else {
            console.log('WHATSAPP_API_URL not configured. Skipping automatic sending.');
        }
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
    }

    return result;
}
