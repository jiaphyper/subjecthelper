"use client";
import { useConfirm } from "./Dialog";

/** 提交前弹出确认框的按钮（放在 <form> 里） */
export default function ConfirmButton({
  message,
  children,
  className = "btn-danger btn-sm",
  okText,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  okText?: string;
}) {
  const confirm = useConfirm();
  const danger = className.includes("btn-danger");
  return (
    <button
      type="submit"
      className={className}
      onClick={async (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        const label = typeof children === "string" ? children : undefined;
        if (await confirm({ message, danger, okText: okText ?? label })) btn.form?.requestSubmit(btn);
      }}
    >
      {children}
    </button>
  );
}
