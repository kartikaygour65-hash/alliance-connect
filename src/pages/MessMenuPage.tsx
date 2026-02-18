import { useRef, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MessMenuView } from "@/components/campus/MessMenuView";

export default function MessMenuPage() {
    return (
        <AppLayout>
            <MessMenuView />
        </AppLayout>
    );
}
