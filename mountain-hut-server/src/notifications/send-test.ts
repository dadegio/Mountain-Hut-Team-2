import { SmtpEmailSender } from "./sender.ts";

async function main() {
  const sender = new SmtpEmailSender();
  await sender.send({
    to: "hiker@example.com",
    subject: "Test Mountain Hut",
    text: "If you read this, the SMTP service is working properly.",
    html: "<p>If you read this, the SMTP service is working properly.</p>",
  });
  console.log("Email sent to Mailpit");
}

main().catch((err) => {
  console.error("Sending failed.:", err);
  process.exit(1);
});