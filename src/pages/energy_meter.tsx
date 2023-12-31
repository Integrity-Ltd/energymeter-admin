import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, DataTableStateEvent, DataTableSelectionChangeEvent, DataTableValueArray } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toast } from "primereact/toast";
import { useForm, Controller, FieldErrors } from "react-hook-form";
import { InputText } from 'primereact/inputtext';
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { classNames } from 'primereact/utils';
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

dayjs.extend(utc)
dayjs.extend(timezone)

declare namespace Intl {
    type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

    function supportedValuesOf(input: Key): string[];
}

const timeZonesList = Intl.supportedValuesOf('timeZone');
const defaultTimeZone = dayjs.tz.guess();

/**
 * The input form objects
 */
interface FormValues {
    id: number,
    asset_name: string;
    ip_address: string;
    port: number;
    time_zone: string;
    enabled: boolean;
}

/**
 * The Zod validation schema of form data
 */
const schema = z.object({
    asset_name: z.string().nonempty(),
    ip_address: z.string().ip("v4").nonempty(),
    port: z.number().min(1),
    time_zone: z.string().nonempty(),
    enabled: z.boolean()
});

/**
 * The power mater component
 * @returns the power meter ReactComponent
 */
const EnergyMeter = () => {
    const queryClient = useQueryClient();
    /**
     * Lazy data model state
     */
    const [lazyState, setLazyState] = useState<DataTableStateEvent>({
        first: 0,
        rows: 10,
        page: 0,
        pageCount: 0,
        sortField: "",
        sortOrder: 1,
        multiSortMeta: [],
        filters: {},
    });

    /**
     * The edited row of power meter
     */
    const [editedRow, setEditedRow] = useState<EnergyMeterValues | null>(null);
    /**
     * The selected row of power meter
     */
    const [selectedRow, setSelectedRow] = useState<EnergyMeterValues | null>(null);
    /**
     * Visibility of form editor dialog
     */
    const [visible, setVisible] = useState(false);
    /**
     * Visibility of confirm dialog
     */
    const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);

    /**
     * On page request of DataTable
     */
    const onPage = useCallback((event: DataTableStateEvent) => {
        setLazyState(event);
    }, []);

    /**
     * Filter on powermeter DataTable
     */
    const onFilter = useCallback((event: DataTableStateEvent) => {
        event.first = 0;
        setLazyState(event);
    }, []);

    /**
     * Selection changed event callback
     */
    const onSelectionChange = useCallback((e: DataTableSelectionChangeEvent<DataTableValueArray>) => {
        setSelectedRow(e.value as EnergyMeterValues);
    }, []);

    /**
     * Reload DataTable and count
     */
    const updatePage = () => {
        queryClient.invalidateQueries({ queryKey: ["energy_meter"] });
        queryClient.invalidateQueries({ queryKey: ["energy_metercount"] });
        setSelectedRow(null);
    };

    /**
     * Power meter data query
     */
    const { data: energy_meterValues, isLoading: isDataLoading } = useQuery({
        queryKey: ["energy_meter", lazyState],
        queryFn: async () => {
            const filters = encodeURIComponent(JSON.stringify(lazyState.filters));
            const res = await fetch(`/api/admin/crud/energy_meter?first=${lazyState.first}&rowcount=${lazyState.rows}&filter=${filters}`);
            let values = await res.json();
            values.forEach((element: EnergyMeterValues, idx: number) => {
                values[idx].enabled = values[idx].enabled ? true : false;
            });
            return values;
        }
    });

    /**
     * Power meter count query
     */
    const { data: count, isLoading: isCountLoading } = useQuery<number>({
        queryKey: ["energy_metercount", lazyState],
        queryFn: async () => {
            const filters = encodeURIComponent(JSON.stringify(lazyState.filters));
            const res = await fetch(`/api/admin/crud/energy_meter/count?filter=${filters}`);
            const { count } = await res.json();
            return count;
        }
    });

    /**
     * Toast reference
     */
    const toast = useRef<Toast>(null);

    /**
     * React hook form
     */
    const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

    /**
     * React hook form submit callback. Use for create and update RestAPI calls
     * 
     * @param data submited data values
     */
    const onSubmit = (data: FormValues) => {
        const params = {
            asset_name: data.asset_name,
            ip_address: data.ip_address,
            port: data.port,
            time_zone: data.time_zone,
            enabled: data.enabled ? true : false,
        };

        if (editedRow && editedRow.id) {
            fetch('/api/admin/crud/energy_meter/' + editedRow.id, {
                method: 'PUT',
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache',
                body: JSON.stringify(params),
            }).then((response) => { return response.json() }).then((data) => {
                updatePage();
                setVisible(false);
                show("success", `Updated energymeter: ${JSON.stringify(data)}`);
            }).catch((err) => show("error", err));
        } else {
            fetch('/api/admin/crud/energy_meter', {
                method: 'POST',
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache',
                body: JSON.stringify(params),
            }).then((response) => { return response.json() }).then((data) => {
                updatePage();
                setVisible(false);
                show('success', `Saved energymeter: ${JSON.stringify(data)}`);
            }).catch((err) => show('error', err));
        }
    }

    /**
     * Show message
     * @param severity severity of message
     * @param message message to display
     */
    const show = (severity: "success" | "info" | "warn" | "error" | undefined, message: string) => {
        if (toast.current !== null) {
            toast.current.show({ severity: severity, summary: 'Form submit', detail: message });
        }
    }

    /**
     * EditedRow useEffect
     */
    useEffect(() => {
        //console.log(selectedRows);
        if (editedRow && editedRow.id) {
            setValue("asset_name", editedRow.asset_name);
            setValue("ip_address", editedRow.ip_address);
            setValue("port", editedRow.port);
            setValue("time_zone", editedRow.time_zone);
            setValue("enabled", editedRow.enabled ? true : false);
        } else {
            setValue("asset_name", '');
            setValue("ip_address", '');
            setValue("port", 50003);
            setValue("time_zone", defaultTimeZone);
            setValue("enabled", false);
        }
    }, [editedRow, setValue]);

    /**
     * Delete selected powermeter with RestAPI
     */
    const deleteSelectedRow = () => {
        if (selectedRow) {
            fetch('/api/admin/crud/energy_meter/' + selectedRow.id, {
                method: 'DELETE',
                credentials: "include",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                cache: 'no-cache',
                body: JSON.stringify({ action: 'delete' }),
            }).then((response) => {
                return response.json();
            }).then(data => {
                show("success", `Deleted energy_meter: ${JSON.stringify(data)}`);
                updatePage();
            }).catch((err) => show("error", err));
        }
    }

    /**
     * React hook form submition error handler
     * @param errors errors
     */
    const onSubmitError = (errors: FieldErrors<FormValues>) => {
        //console.log(errors);
        show("error", "Please fill form as needed. Read tooltips on red marked fields.");
    }

    /**
     * DataTable reference
     */
    const dt = useRef<DataTable<DataTableValueArray>>(null);

    /**
     * Export measurements data to CSV
     * @param selectionOnly export only selected data 
     */
    const exportCSV = (selectionOnly: boolean) => {
        if (dt && dt.current) {
            const currentRef = dt.current;
            currentRef.exportCSV({ selectionOnly });
        }
    };

    const header = (
        <div className="flex align-items-center justify-content-end gap-2">
            <Button type="button" icon="pi pi-file" rounded onClick={() => exportCSV(false)} data-pr-tooltip="CSV" />
        </div>
    );

    return (
        <div className="card">
            <h2>Energy meter</h2>
            <Toast ref={toast} />
            <Dialog header="Energy meter" visible={visible} onHide={() => setVisible(false)} style={{ width: '50vw' }}>
                <form onSubmit={handleSubmit(onSubmit, onSubmitError)} style={{ width: '100%' }}>
                    <Controller
                        name="asset_name"
                        control={control}
                        rules={{ required: 'asset name is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>Asset name: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <InputText id={field.name} value={field.value || ''} tooltip={errors.asset_name?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={field.onChange} style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <Controller
                        name="ip_address"
                        control={control}
                        rules={{ required: 'IP Address is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>IP Address: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <InputText disabled={(editedRow !== undefined && editedRow !== null) && editedRow.id > -1} id={field.name} value={field.value || ''} tooltip={errors.ip_address?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={field.onChange} style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <Controller
                        name="port"
                        control={control}
                        rules={{ required: 'Port is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>Port: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <InputNumber disabled={(editedRow !== undefined && editedRow !== null) && editedRow.id > -1} id={field.name} value={field.value} tooltip={errors.port?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onValueChange={(event) => field.onChange((event.target.value as number))} style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <Controller
                        name="time_zone"
                        control={control}
                        rules={{ required: 'Time zone is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>Time zone: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <Dropdown id={field.name} value={field.value} tooltip={errors.time_zone?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={(event) => field.onChange(event.target.value)} options={timeZonesList} placeholder="Select TimeZone" style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <Controller
                        name="enabled"
                        control={control}
                        rules={{ required: 'Enabled is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>Enabled: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <Checkbox onChange={(event) => field.onChange(event.target.checked ? true : false)} tooltip={errors.enabled?.message} className={classNames({ 'p-invalid': fieldState.invalid })} checked={field.value}></Checkbox>
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <div className='flex justify-content-end'>
                        <Button label="Submit" type="submit" icon="pi pi-check" />
                    </div>
                </form>
            </Dialog>
            <ConfirmDialog visible={confirmDialogVisible} accept={deleteSelectedRow} message="Are you sure you want to delete item?"
                header="Confirmation" icon="pi pi-exclamation-triangle" onHide={() => setConfirmDialogVisible(false)} />
            <div className="card">
                <DataTable value={energy_meterValues}
                    ref={dt}
                    header={header}
                    selectionMode="single"
                    selection={selectedRow}
                    onSelectionChange={onSelectionChange}
                    first={lazyState.first}
                    paginator={true}
                    lazy={true}
                    rows={10}
                    totalRecords={count ?? 0}
                    onPage={onPage}
                    loading={isDataLoading || isCountLoading}
                    onFilter={onFilter}
                    filters={lazyState.filters}
                    filterDisplay="row"
                    tableStyle={{ minWidth: '50rem' }}
                >
                    <Column selectionMode="single" header="Select one"></Column>
                    <Column field="asset_name" header="Asset name"></Column>
                    <Column field="ip_address" header="IP address"></Column>
                    <Column field="port" header="Port"></Column>
                    <Column field="time_zone" header="Time zone"></Column>
                    <Column field="enabled" header="Enabled"></Column>
                </DataTable>
            </div>
            <div className='vertical-align-baseline'>
                <Button label="New" icon="pi pi-check" onClick={() => {
                    setSelectedRow(null);
                    setEditedRow(null);
                    setVisible(true);
                }} />
                <Button label="Modify" icon="pi pi-check" onClick={() => {
                    setEditedRow(selectedRow);
                    control._formValues['time_zone'] = defaultTimeZone;
                    setVisible(true);
                }} disabled={selectedRow && selectedRow.id ? false : true} />
                <Button label="Delete" icon="pi pi-check" onClick={() => setConfirmDialogVisible(true)} disabled={selectedRow && selectedRow.id ? false : true} />
            </div>
        </div>
    )
}

export default EnergyMeter;

