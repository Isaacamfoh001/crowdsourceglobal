"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "../../lib/auth-client";
import { Button } from "../ui/Button";

export function SignOutButton({
  fullWidth = false,
  size = "md",
}: {
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      variant="outline"
      size={size}
      fullWidth={fullWidth}
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        await signOut();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      {isPending ? "Signing out…" : "Log out"}
    </Button>
  );
}
