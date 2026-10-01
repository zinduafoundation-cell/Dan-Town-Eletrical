import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { PWARegister } from "@/components/pwa-register";
import { HistoryNavigation } from "@/components/history-navigation";
import "./globals.css";
import "./auth.css";
import "./styles/tokens.css";
import "./styles/themes.css";
import "./styles/pos.css";
import "./styles/account.css";

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
				<Providers>
					{children}
					<HistoryNavigation />
				</Providers>
			</body>
		</html>
	);
}
