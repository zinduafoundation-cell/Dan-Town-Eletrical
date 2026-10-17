import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import { PWARegister } from "@/components/pwa-register";
import { CentreAppGuard } from "@/components/centre/centre-app-guard";
import { HistoryNavigation } from "@/components/history-navigation";
import { ReceiptEffect } from "@/components/pos/receipt-effect";
import "./globals.css";
import "./styles/centre-app.css";
import "./auth.css";
import "./styles/tokens.css";
import "./styles/themes.css";
import "./styles/pos.css";
import "./styles/account.css";
import "./styles/navigation-sidebar.css";
import "./styles/fixes.css";

export const metadata: Metadata = {
	title: {
		default: "Dantown Electrical | Powering Kitale, one home at a time.",
		template: "%s | Dantown Electrical",
	},
	description: "Electrical, solar and lighting products and services from Kitale, Kenya.",
	manifest: "/manifest.json",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" data-scroll-behavior="smooth">
			<body>
				<PWARegister />
				<CentreAppGuard />
				<Providers>
					{children}
					<HistoryNavigation />
					<ReceiptEffect />
				</Providers>
				<SpeedInsights />
			</body>
		</html>
	);
}
