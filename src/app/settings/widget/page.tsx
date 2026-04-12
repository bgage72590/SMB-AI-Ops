import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isWidgetConfigured, generateWidgetToken } from "@/lib/widget";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

export default function WidgetSettingsPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const configured = isWidgetConfigured();
  const token = configured ? generateWidgetToken(user.id) : null;

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const snippet = token
    ? `<!-- SMB AI Ops Chat Widget -->
<div id="smbaiops-widget"></div>
<script>
(function() {
  var w = document.createElement('div');
  w.id = 'smbaiops-chat';
  w.innerHTML = '<div style="position:fixed;bottom:20px;right:20px;z-index:9999">'
    + '<button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\\'none\\'?\\'block\\':\\'none\\'" '
    + 'style="width:56px;height:56px;border-radius:50%;background:#6366f1;color:#fff;border:none;cursor:pointer;font-size:24px;box-shadow:0 4px 12px rgba(0,0,0,.15)">?</button>'
    + '<div style="display:none;position:absolute;bottom:70px;right:0;width:360px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.12);overflow:hidden">'
    + '<div style="background:#6366f1;color:#fff;padding:16px"><strong>Get in touch</strong><br><small>We usually reply within an hour</small></div>'
    + '<form onsubmit="return smbaiops_send(this)" style="padding:16px;display:flex;flex-direction:column;gap:8px">'
    + '<input name="name" placeholder="Your name" required style="padding:8px;border:1px solid #e5e7eb;border-radius:6px">'
    + '<input name="email" type="email" placeholder="Email" required style="padding:8px;border:1px solid #e5e7eb;border-radius:6px">'
    + '<input name="phone" placeholder="Phone (optional)" style="padding:8px;border:1px solid #e5e7eb;border-radius:6px">'
    + '<textarea name="message" placeholder="How can we help?" required rows="3" style="padding:8px;border:1px solid #e5e7eb;border-radius:6px;resize:none"></textarea>'
    + '<button type="submit" style="padding:10px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">Send</button>'
    + '<div class="smbaiops-status" style="text-align:center;font-size:13px"></div>'
    + '</form></div></div>';
  document.body.appendChild(w);
  window.smbaiops_send = function(form) {
    var s = form.querySelector('.smbaiops-status');
    s.textContent = 'Sending...';
    fetch('${origin}/api/widget/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        token: '${token.token}',
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value || undefined,
        message: form.message.value
      })
    }).then(function(r) {
      if (r.ok) { s.textContent = 'Sent! We\\'ll be in touch.'; form.reset(); }
      else { s.textContent = 'Something went wrong. Try again.'; }
    }).catch(function() { s.textContent = 'Network error. Try again.'; });
    return false;
  };
})();
</script>`
    : "";

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        title="Website Chat Widget"
        description="Embed a lead capture form on your website"
      />

      {!configured ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-muted">
              Set <code className="text-fg">WIDGET_SECRET</code> in your
              environment to enable the chat widget. Any random string works
              as a signing secret.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="How it works" />
            <CardBody className="space-y-3 text-sm text-fg-muted">
              <p>
                Paste the snippet below into your website. Visitors fill out a
                short form and their message lands in your inbox as a new lead
                email, ready for AI triage.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Works on any website (WordPress, Wix, Squarespace, static HTML)</li>
                <li>No signup required from visitors</li>
                <li>Rate-limited to prevent abuse (10 messages/minute per IP)</li>
                <li>Messages appear in your inbox within seconds</li>
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Embed snippet" />
            <CardBody>
              <pre className="text-xs bg-surface-2 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all text-fg-muted">
                {snippet}
              </pre>
              <p className="text-xs text-fg-subtle mt-2">
                Copy this snippet and paste it before the closing{" "}
                <code>&lt;/body&gt;</code> tag on your website.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </main>
  );
}
