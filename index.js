// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------------------------------------------------
// CONFIGURACIÓN (usa variables de entorno para seguridad)
// ---------------------------------------------------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "mi_token_personalizado";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Verificación básica de que los datos esenciales no falten
if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error("❌ Faltan WHATSAPP_TOKEN o PHONE_NUMBER_ID en las variables de entorno.");
    process.exit(1);
}

// ---------------------------------------------------
// RUTA DE VERIFICACIÓN (GET) – Para activar el webhook en Meta
// ---------------------------------------------------
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado correctamente');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Fallo en la verificación del webhook');
        res.sendStatus(403);
    }
});

// ---------------------------------------------------
// RUTA DE RECEPCIÓN DE MENSAJES (POST) – Aquí llegan los mensajes
// ---------------------------------------------------
app.post('/webhook', async (req, res) => {
    // Siempre responde 200 inmediatamente para que Meta sepa que lo recibiste
    console.log("🚨 POST recibido en /webhook");
    const body = req.body;

    res.sendStatus(200);

    console.log(JSON.stringify(body, null, 2));

    try {
        if (body.object) {
            const entries = body.entry;
            if (entries && entries.length > 0) {
                for (const entry of entries) {
                    const changes = entry.changes;
                    if (changes && changes.length > 0) {
                        for (const change of changes) {
                            if (change.value && change.value.messages) {
                                const messages = change.value.messages;
                                for (const message of messages) {

                                    const from = message.from;

                                    // -----------------------------
                                    // MENSAJES DE TEXTO
                                    // -----------------------------
                                    if (message.type === 'text') {

                                        const text = message.text.body.toLowerCase();

                                        if (
                                            text.includes('hola') ||
                                            text.includes('menu') ||
                                            text.includes('rrhh')
                                        ) {
                                            await sendMainMenu(from);
                                        } else {
                                            await sendTextMessage(
                                                from,
                                                'Escriba "menu" para ver las opciones disponibles.'
                                            );
                                        }
                                    }

                                    // -----------------------------
                                    // BOTONES INTERACTIVOS
                                    // -----------------------------
                                    if (message.type === 'interactive') {

                                        const option =
                                            message.interactive.list_reply.id;

                                        console.log('👉 Opción:', option);

                                        switch (option) {

                                            case 'vacaciones':
                                                await sendTextMessage(
                                                    from,
                                                    '📅 Para Consultar o solicitar vacaciones por favor comuniquese con su supervisor.'
                                                );
                                                break;

                                            case 'recibos':
                                                await sendTextMessage(
                                                    from,
                                                    '💰 Tu último recibo ya está disponible en la app SIA.'
                                                );
                                                break;

                                            case 'sia':
                                                await sendTextMessage(
                                                    from,
                                                    '💻 Tome captura de pantalla y envieselo a su supervisor junto a una descripcion detallada del error, nos hara llegar el inconveniente'
                                                );
                                                break;

                                            case 'rrhh':
                                                await sendTextMessage(
                                                    from,
                                                    '📞 Escriba a continuacion su duda/reclamo, nos estaremos comunicando a la brevedad.'
                                                );
                                                break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error procesando el mensaje:', error.message);
    }
});

// ---------------------------------------------------
// FUNCIÓN PARA ENVIAR UN MENSAJE DE TEXTO
// ---------------------------------------------------
async function sendTextMessage(to, text) {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'text',
                text: { body: text },
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`✅ Mensaje enviado a ${to}: ${text}`);
        return response.data;
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
        throw error;
    }
}

async function sendMainMenu(to) {

    try {

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'interactive',
                interactive: {
                    type: 'list',

                    body: {
                        text:
                            '👋 Bienvenido al asistente de RRHH.\n\nSeleccioná una opción:'
                    },

                    footer: {
                        text: 'Empresa Ezca Servicios Generales.'
                    },

                    action: {
                        button: 'Ver opciones',

                        sections: [
                            {
                                title: 'Gestiones RRHH',

                                rows: [
                                    {
                                        id: 'vacaciones',
                                        title: '📅 Vacaciones',
                                        description:
                                            'Consultar o solicitar vacaciones'
                                    },

                                    {
                                        id: 'recibos',
                                        title: '💰 Recibos',
                                        description:
                                            'Ver recibos de sueldo'
                                    },

                                    {
                                        id: 'sia',
                                        title: '💻 Inconvenientes app SIA',
                                        description:
                                            'Problemas técnicos'
                                    },

                                    {
                                        id: 'rrhh',
                                        title: '📞 Contactar RRHH',
                                        description:
                                            'Hablar con un representante'
                                    },
                                ]
                            }
                        ]
                    }
                }
            },

            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('✅ Menú LIST enviado');

        return response.data;

    } catch (error) {

        console.error(
            '❌ Error enviando menú:',
            error.response?.data || error.message
        );
    }
}

// ---------------------------------------------------
// INICIAR EL SERVIDOR
// ---------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor del bot corriendo en el puerto ${PORT}`);
});