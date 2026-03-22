import { useEffect, useRef, useState } from "react";

const CHAR_INTERVAL = 25;

type Options = {
	text: string;
	isActive: boolean;
	intervalMs?: number;
	onDone?: () => void;
};

export function useTypewriter({ text, isActive, intervalMs, onDone }: Options): { typed: string } {
	const [typed, setTyped] = useState("");
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const indexRef = useRef(0);

	useEffect(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		if (!isActive) {
			setTyped("");
			indexRef.current = 0;
			return;
		}

		setTyped("");
		indexRef.current = 0;

		intervalRef.current = setInterval(() => {
			indexRef.current += 1;
			setTyped(text.slice(0, indexRef.current));
			if (indexRef.current >= text.length) {
				clearInterval(intervalRef.current!);
				intervalRef.current = null;
				onDone?.();
			}
		}, intervalMs ?? CHAR_INTERVAL);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [isActive, text]);

	return { typed };
}