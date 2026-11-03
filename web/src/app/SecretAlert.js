import { useState } from "react";
import PropTypes from "prop-types";
import { Check, Copy } from "lucide-react";
import { Alert } from "components/alert";
import { Button } from "components/button";

/** A secret (token or temporary password) shown once, with a Copy button. */
export function SecretAlert({ title, secret, noun, onDismiss, onCopy, details, extraCopy }) {
  const [copied, setCopied] = useState(false);
  const [extraCopied, setExtraCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      onCopy?.();
    } catch {
      setCopied(false);
    }
  };
  const copyExtra = async () => {
    try {
      await navigator.clipboard.writeText(extraCopy.text);
      setExtraCopied(true);
    } catch {
      setExtraCopied(false);
    }
  };
  return (
    <Alert
      status="warning"
      kind="outlined"
      title={title}
      onDismiss={onDismiss}
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" kind="outlined" prefixIcon={copied ? <Check /> : <Copy />} onClick={copy}>
            {copied ? "Copied" : extraCopy ? `Copy ${noun}` : "Copy"}
          </Button>
          {extraCopy && (
            <Button size="sm" kind="outlined" prefixIcon={extraCopied ? <Check /> : <Copy />} onClick={copyExtra}>
              {extraCopied ? "Copied" : extraCopy.label}
            </Button>
          )}
        </div>
      }
    >
      <code data-testid="secret" className="break-all">{secret}</code>
      <p>You will not see this {noun} again.</p>
      {details}
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
  /** Extra lines shown under the secret, for example where to use it. */
  details: PropTypes.node,
  /** A second Copy button for a longer text that holds the secret, e.g. a ready-to-send message: { label, text }. */
  extraCopy: PropTypes.shape({ label: PropTypes.string.isRequired, text: PropTypes.string.isRequired }),
};
