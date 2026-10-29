import { SmtpEmailSender } from "./sender.ts";

async function main() {
  const sender = new SmtpEmailSender();
  await sender.send({
    to: "hiker@example.com",
    subject: "Test Mountain Hut",
    text: "If u read this, the SMPT service is working properly.",
    html: "<p>If u read this, the SMPT service is working properly.</p>",
  });
  console.log("Email inviata a Mailpit");
}

main().catch((err) => {
  console.error("Invio fallito:", err);
  process.exit(1);
});