import { SmtpEmailSender } from "./sender.ts";

async function main() {
  const sender = new SmtpEmailSender();
  await sender.send({
    to: "giacomoviviano03@gmail.com",
    subject: "Test Mountain Hut - Real Email Notification",
    text: "If you read this, the Mountain Hut email notification service is working properly!",
    html: "<h2>Mountain Hut 🏔️</h2><p>If you read this, the <strong>Mountain Hut email notification service</strong> is working properly! 🎉✉️</p>",
  });
  console.log("Email sent successfully to mountain.hut.team2@gmail.com!");
}

main().catch((err) => {
  console.error("Sending failed:", err);
  process.exit(1);
});