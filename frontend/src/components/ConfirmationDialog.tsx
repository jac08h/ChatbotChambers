import { useEffect } from "react";

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    showCancel?: boolean;
    isConfirming?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationDialog({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel = "Cancel",
    showCancel = true,
    isConfirming = false,
    onConfirm,
    onCancel,
}: ConfirmationDialogProps) {
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isConfirming) {
                onCancel();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isConfirming, isOpen, onCancel]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="confirmation-dialog-backdrop"
            role="presentation"
            onClick={() => {
                if (!isConfirming) {
                    onCancel();
                }
            }}
        >
            <div
                className="confirmation-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirmation-dialog-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="confirmation-dialog-header">
                    <h2 id="confirmation-dialog-title" className="confirmation-dialog-title">{title}</h2>
                </div>
                <p className="confirmation-dialog-message">{message}</p>
                <div className="confirmation-dialog-actions">
                    {showCancel && (
                        <button
                            type="button"
                            className="confirmation-dialog-cancel"
                            onClick={onCancel}
                            disabled={isConfirming}
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        className="confirmation-dialog-confirm"
                        onClick={onConfirm}
                        disabled={isConfirming}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
