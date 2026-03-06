export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { receipt, user, budget, total, createdAt } = req.body || {};

    const token   = process.env.BOT_TOKEN;
    const chatId1 = process.env.CHAT_ID;
    const chatId2 = process.env.CHAT_ID_2; // второй получатель (необязательно)

    if (!token || !chatId1) {
      return res.status(500).send("Missing BOT_TOKEN or CHAT_ID env vars");
    }

    const text =
      `🧾 Новый заказ (8 марта)\n` +
      `Имя: ${(user && user.name) ? user.name : "—"}\n` +
      `Бюджет: ${budget ?? "—"}$\n` +
      `Итого: ${total ?? "—"}$\n` +
      `Время: ${createdAt ?? "—"}\n\n` +
      (receipt || "—");

    // Отправляем в оба чата параллельно
    const targets = [chatId1];
    if (chatId2) targets.push(chatId2);

    const results = await Promise.all(
      targets.map(chatId =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true
          })
        }).then(r => r.json())
      )
    );

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      return res.status(500).json({ errors: failed });
    }

    return res.status(200).json({ ok: true, sent: targets.length });
  } catch (e) {
    return res.status(500).send(String(e));
  }
}
