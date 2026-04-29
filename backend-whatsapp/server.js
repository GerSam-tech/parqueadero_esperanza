import express from "express";
import cors from "cors";
import twilio from "twilio";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_TOKEN
);

// ENDPOINT PARA WHATSAPP

// ENDPOINT PARA WHATSAPP (USA OBSERVACIONES)

app.post("/whatsapp", async (req, res) => {
  const { telefono, mensaje } = req.body;

  console.log("📩 /whatsapp recibido:", req.body); // 🔥 CLAVE

  if (!telefono || !mensaje) {
    console.log("❌ Datos incompletos");
    return res.status(400).json({ ok: false });
  }

  try {
    await client.messages.create({
      from: "whatsapp:+14155238886",
      to: `whatsapp:+${telefono}`,
      body: mensaje,
    });

    console.log("✅ WhatsApp enviado a", telefono);
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Error Twilio:", error);
    res.status(500).json({ ok: false });
  }
});


app.listen(3001, () => {
  console.log("✅ Backend WhatsApp activo en http://localhost:3001");
});