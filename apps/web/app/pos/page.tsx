import { POSDashboard } from "@/components/pos/pos-dashboard";
import { SharedAIPanel } from "@/components/ai/shared-ai-panel";export const metadata = {title : "Dashboard | DANTOWN POS"
};export default function POSPage() {return <><POSDashboard /><div style={{ marginTop : 20 }}><SharedAIPanel title="Dan T AI POS Assistant" subtitle="Product, stock, sync, and safe POS guidance" surface="pos" suggestions={["Find product", "Check stock", "Sync issues", "Today's POS summary"]} compact /></div></>;
}
