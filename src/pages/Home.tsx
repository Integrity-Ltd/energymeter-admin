import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Controller, useForm } from "react-hook-form";
import * as z from 'zod';
import { Toast } from "primereact/toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "primereact/button";
import { classNames } from "primereact/utils";
import { Calendar } from 'primereact/calendar';
import { Dropdown } from "primereact/dropdown";
import moment from "moment";

interface FormValues {
    fromDate: string;
    toDate: string;
    ipAddress: string;
    channel: number;
    details: string;
}

const details = ['hourly', 'daily', 'monthly'];

const Home = () => {

    const [measurements, setMeasurements] = useState([]);

    const [channels, setChannels] = useState([]);

    const schema = z.object({
        fromDate: z.date(),
        toDate: z.date(),
        ipAddress: z.string().ip("v4").nonempty(),
        channel: z.number().nullable(),
        details: z.string().nonempty()
    });

    const toast = useRef<Toast>(null);

    const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

    const show = (severity: "success" | "info" | "warn" | "error" | undefined, message: string) => {
        if (toast.current !== null) {
            toast.current.show({ severity: severity, summary: 'Form submit', detail: message });
        }
    }

    const onSubmitError = (errors: any) => {
        //console.log(errors);
        show("error", "Please fill form as needed. Read tooltips on red marked fields.");
    }

    const onSubmit = (data: any) => {
        if (moment(data.fromDate).get("year") < moment().get("year") && (data.details !== "monthly")) {
            show("error", "Details must be monthly when required year less then current year");
        } else {
            updateTable(data);
        }
    }

    const header = (
        <div className="flex align-items-center justify-content-end gap-2">
            <Button type="button" icon="pi pi-file" rounded onClick={() => exportCSV(false)} data-pr-tooltip="CSV" />
        </div>
    );

    const dt = useRef<any>(null);

    const exportCSV = (selectionOnly: boolean) => {
        if (dt && dt.current) {
            const currentRef = dt.current;
            currentRef.exportCSV({ selectionOnly });
        }
    };

    const fetchEnergy_meterValues = async () => {
        let response = await fetch('/api/admin/crud/energy_meter');
        let data = await response.json();
        return data;
    }

    const { data: energy_meterValues } = useQuery({
        queryKey: ["energy_meter"],
        queryFn: fetchEnergy_meterValues
    });

    const fetchChannels = async (energy_meter_id: number) => {
        let filter = encodeURIComponent(JSON.stringify({ energy_meter_id: energy_meter_id }));
        let result = await fetch('/api/admin/crud/channels?filter=' + filter);
        let data = await result.json();
        setChannels(data);
    }

    const updateTable = async (params: any) => {
        let values = [];
        let path = `/api/measurements/report?fromdate=${moment(params.fromDate).format("YYYY-MM-DD")}&todate=${moment(params.toDate).format("YYYY-MM-DD")}&ip=${params.ipAddress}&details=${params.details}`;
        if (params.channel > 0) {
            path += `&channel=${params.channel}`;
        }
        const res = await fetch(path);
        values = await res.json();
        if (values.err) {
            show("error", values.err);
            values = [];
        }
        setMeasurements(values);
    }

    return (
        <div className="card">
            <Toast ref={toast} />
            <h1>Measurements</h1>
            <div className="">
                <form onSubmit={handleSubmit(onSubmit, onSubmitError)} style={{ width: '100%' }}>
                    <Controller
                        name="fromDate"
                        control={control}
                        rules={{ required: 'from date is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <Calendar id={field.name} value={field.value || ''} placeholder="From date" tooltip={errors.fromDate?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={(event) => field.onChange((event.target.value as string))} dateFormat="yy-mm-dd" />
                            </>
                        )}
                    />
                    <Controller
                        name="toDate"
                        control={control}
                        rules={{ required: 'to date is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <Calendar id={field.name} value={field.value || ''} placeholder="To date" tooltip={errors.fromDate?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={(event) => field.onChange((event.target.value as string))} dateFormat="yy-mm-dd" />
                            </>
                        )}
                    />
                    <Controller
                        name="ipAddress"
                        control={control}
                        rules={{ required: 'Time zone is required.' }}
                        render={({ field, fieldState }) => (
                            <>

                                <Dropdown id={field.name} value={field.value} tooltip={errors.ipAddress?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={(event) => {
                                    let energymeter = energy_meterValues.filter((item: any) => {
                                        return item.ip_address === event.target.value;
                                    })
                                    if (energymeter.length > 0) {
                                        fetchChannels(energymeter[0].id);
                                    }
                                    field.onChange(event.target.value)
                                }} options={energy_meterValues} optionLabel="asset_name" optionValue="ip_address" placeholder="Select asset" />


                            </>
                        )}
                    />
                    <Controller
                        name="channel"
                        control={control}
                        rules={{}}
                        render={({ field, fieldState }) => (
                            <>
                                <Dropdown id={field.name} value={field.value} tooltip={errors.channel?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={(event) => field.onChange(event.target.value)} options={[{ channel_name: "All", channel: -1 }, ...channels]} optionLabel="channel_name" optionValue="channel" placeholder="Select channel" />
                            </>
                        )}
                    />
                    <Controller
                        name="details"
                        control={control}
                        rules={{ required: 'Details is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <Dropdown id={field.name} value={field.value} tooltip={errors.ipAddress?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={(event) => field.onChange(event.target.value)} options={details} placeholder="Select details" />
                            </>
                        )}
                    />
                    <span className="filter-labels">
                        <Button label="Send" icon="pi pi-check" type="submit" />
                    </span>
                </form>
            </div>
            <div className="card">
                <DataTable value={measurements}
                    ref={dt}
                    header={header}
                    tableStyle={{ minWidth: '50rem' }}
                >
                    <Column field="from_local_time" header="From local Time"></Column>
                    <Column field="to_local_time" header="To local Time"></Column>
                    <Column field="from_utc_time" header="From UTC Time"></Column>
                    <Column field="to_utc_time" header="To UTC Time"></Column>
                    <Column field="channel" header="Channel"></Column>
                    <Column field="measured_value" header="Measured value"></Column>
                    <Column field="diff" header="Diff"></Column>
                </DataTable>
            </div>
        </div>
    )
}

export default Home;
