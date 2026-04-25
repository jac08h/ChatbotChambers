import { useEffect, useRef, useState } from "react";

interface ApiKeyDialogProps {
    isOpen: boolean;
    initialValue: string;
    onCancel: () => void;
    onConfirm: (value: string) => Promise<boolean> | boolean;
}

function isValidOpenRouterKey(value: string): boolean {
    return /^sk-or-v1-[A-Za-z0-9_-]+$/.test(value.trim());
}

export function ApiKeyDialog({
    isOpen,
    initialValue,
    onCancel,
    onConfirm,
}: ApiKeyDialogProps) {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        inputRef.current?.focus();
        inputRef.current?.select();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isSaving) {
                onCancel();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isSaving, onCancel]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="rename-dialog-backdrop"
            role="presentation"
            onClick={() => {
                if (!isSaving) {
                    onCancel();
                }
            }}
        >
            <div
                className="rename-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="api-key-dialog-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="rename-dialog-header">
                    <h2 id="api-key-dialog-title" className="rename-dialog-title">Set OpenRouter API key</h2>
                </div>
                <p className="api-key-dialog-copy">
                    Hosted ChatbotChambers sends your key only to the same-origin <code>/api/turn</code> proxy and never stores it server-side.
                </p>
                <input
                    ref={inputRef}
                    className="rename-dialog-input"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={value}
                    onChange={(event) => {
                        setValue(event.target.value);
                        setError(null);
                    }}
                    placeholder="sk-or-v1-..."
                    disabled={isSaving}
                />
                {error && <div className="error-banner api-key-error">{error}</div>}
                <div className="rename-dialog-actions">
                    <button
                        type="button"
                        className="rename-dialog-cancel"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="rename-dialog-confirm"
                        onClick={async () => {
                            const trimmedValue = value.trim();
                            if (!isValidOpenRouterKey(trimmedValue)) {
                                setError("Enter a valid OpenRouter key.");
                                return;
                            }
                            setIsSaving(true);
                            const saved = await onConfirm(trimmedValue);
                            setIsSaving(false);
                            if (!saved) {
                                setError("Failed to save key.");
                            }
                        }}
                        disabled={isSaving || !value.trim()}
                    >
                        Save key
                    </button>
                </div>
            </div>
        </div>
    );
}
