import { useEffect, useRef, useState } from "react";

interface RenameDialogProps {
    isOpen: boolean;
    title: string;
    initialValue: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isSaving?: boolean;
    onConfirm: (value: string) => void;
    onCancel: () => void;
}

export function RenameDialog({
    isOpen,
    title,
    initialValue,
    confirmLabel = "Save",
    cancelLabel = "Cancel",
    isSaving = false,
    onConfirm,
    onCancel,
}: RenameDialogProps) {
    const [value, setValue] = useState(initialValue);
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
                aria-labelledby="rename-dialog-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="rename-dialog-header">
                    <h2 id="rename-dialog-title" className="rename-dialog-title">{title}</h2>
                </div>
                <input
                    ref={inputRef}
                    className="rename-dialog-input"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            const trimmedValue = value.trim();
                            if (trimmedValue) {
                                onConfirm(trimmedValue);
                            }
                        }
                    }}
                    disabled={isSaving}
                />
                <div className="rename-dialog-actions">
                    <button
                        type="button"
                        className="rename-dialog-cancel"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="rename-dialog-confirm"
                        onClick={() => {
                            const trimmedValue = value.trim();
                            if (trimmedValue) {
                                onConfirm(trimmedValue);
                            }
                        }}
                        disabled={isSaving || !value.trim()}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
