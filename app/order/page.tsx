// app/order/page.tsx
import { redirect } from "next/navigation";

export default function OrderIndexPage() {
  redirect("/order/menu");
}
