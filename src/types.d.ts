/**
 * The input form objects
 */
interface FormValues {
    fromDate: string;
    toDate: string;
    ipAddress: string;
    channel: number;
    details: string;
}

interface EnergyMeterValues {
    asset_name: string,
    ip_address: string,
    port: number,
    time_zone: string,
    enabled: boolean,
}
