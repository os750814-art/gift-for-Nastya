export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { receipt, user, budget, total, createdAt } = req.body || {};

    const token = process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID;

    if (!token || !chatId) {
      return res.status(500).send("Missing BOT_TOKEN or CHAT_ID env vars");
    }

    const text =
      `🧾 Новый заказ (8 марта)\n` +
      `Имя: ${(user && user.name) ? user.name : "—"}\n` +
      `Бюджет: ${budget ?? "—"}\n` +
      `Итого: ${total ?? "—"}\n` +
      `Время: ${createdAt ?? "—"}\n\n` +
      (receipt || "—");

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });

    const data = await tgRes.json();
    if (!data.ok) {
      return res.status(500).json(data);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).send(String(e));
  }
}
