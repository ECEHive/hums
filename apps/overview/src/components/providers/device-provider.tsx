import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

interface Device {
	id: number;
	name: string;
	ipAddress: string;
	isActive: boolean;
	hasKioskAccess: boolean;
	hasDashboardAccess: boolean;
}

interface DeviceContextType {
	device: Device | null;
	isDevice: boolean;
	hasDashboardAccess: boolean;
	isLoading: boolean;
}

const DeviceContext = createContext<DeviceContextType>({
	device: null,
	isDevice: false,
	hasDashboardAccess: false,
	isLoading: true,
});

export function DeviceProvider({ children }: { children: ReactNode }) {
	const { data, isLoading } = useQuery({
		queryKey: ["deviceStatus"],
		queryFn: async () => {
			return await trpc.devices.checkStatus.query({});
		},
		retry: 1,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	const device = data?.status ? (data.device as Device) : null;
	const isDevice = data?.status ?? false;
	const hasDashboardAccess = device?.hasDashboardAccess ?? false;

	return (
		<DeviceContext.Provider
			value={{
				device,
				isDevice,
				hasDashboardAccess,
				isLoading,
			}}
		>
			{children}
		</DeviceContext.Provider>
	);
}

export function useDevice() {
	return useContext(DeviceContext);
}
