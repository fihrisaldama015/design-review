import { useState } from "react";
import PropTypes from "prop-types";
import { Check, Copy } from "lucide-react";
import { Alert } from "components/alert";
import { Button } from "components/button";

/** A secret (token or temporary password) shown once, with a Copy button. */
export function SecretAlert({ title, secret, noun, onDismiss, onCopy }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      onCopy?.();
    } catch {
      setCopied(false);
    }
  };
  return (
    <Alert
      status="warning"
      kind="outlined"
      title={title}
      onDismiss={onDismiss}
      action={
        <Button size="sm" kind="outlined" prefixIcon={copied ? <Check /> : <Copy />} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      }
    >
      <code data-testid="secret" className="break-all">{secret}</code>
      <p>You will not see this {noun} again.</p>
    </Alert>
  );
}
SecretAlert.propTypes = {
  /** What was created, e.g. "New token". */
  title: PropTypes.string.isRequired,
  /** What the secret is, used in "You will not see this {noun} again." */
  noun: PropTypes.oneOf(["token", "password"]).isRequired,
  /** The secret to show. */
  secret: PropTypes.string.isRequired,
  /** Called when the alert is dismissed. Leave it out to keep the alert on screen. */
  onDismiss: PropTypes.func,
  /** Called once the secret was copied with the Copy button. */
  onCopy: PropTypes.func,
};
