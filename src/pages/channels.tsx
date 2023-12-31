import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, DataTableStateEvent, DataTableSelectionChangeEvent, DataTableValueArray } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toast } from "primereact/toast";
import { useForm, Controller, FieldErrors, SubmitHandler } from "react-hook-form";
import { InputText } from 'primereact/inputtext';
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { classNames } from 'primereact/utils';
import { convertToCSV, downloadCSVFile } from "../utils/Converter";

/**
 * The input form objects
 */
interface FormValues {
    energy_meter_id: number;
    channel: number;
    channel_name: string;
    enabled: boolean;
}

/**
 * The Zod validation schema of form data
 */
const schema = z.object({
    energy_meter_id: z.number(),
    channel: z.number().min(1),
    channel_name: z.string().nonempty(),
    enabled: z.boolean()
});

/**
 * The Channels component
 * @returns the Channels ReactComponent
 */
const Channels = () => {
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
        filters: {
        },
    });

    /**
     * The edited row of channel
     */
    const [editedRow, setEditedRow] = useState<ChannelValues | null>(null);
    /**
     * The selected row of channel
     */
    const [selectedRow, setSelectedRow] = useState<ChannelValues | null>(null);
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
        setSelectedRow(e.value as ChannelValues);
    }, []);

    /**
     * Reload DataTable and count
     */
    const updatePage = () => {
        queryClient.invalidateQueries({ queryKey: ["channels"] });
        queryClient.invalidateQueries({ queryKey: ["channelscount"] });
        setSelectedRow(null);
    };
    /**
     * Channels query with RestAPI call
     */
    // eslint-disable-next-line
    const { data: channelsValues, status: dataFetchStatus, isLoading: isDataLoading } = useQuery({
        queryKey: ["channels", lazyState],
        queryFn: async () => {
            const filters = encodeURIComponent(JSON.stringify(lazyState.filters));
            const res = await fetch(`/api/admin/crud/channels?first=${lazyState.first}&rowcount=${lazyState.rows}&filter=${filters}`);
            const values = await res.json();

            const resEnergyMeters = await fetch(`/api/admin/crud/energy_meter`);
            const energyMetersValues = await resEnergyMeters.json();

            values.forEach((element: ChannelValues, idx: number) => {
                const result = energyMetersValues.filter((energyMeter: EnergyMeterValues) => {
                    return energyMeter.id === element.energy_meter_id;
                });
                if (result.length > 0) {
                    values[idx].assset_name = result[0].asset_name;
                }
                values[idx].enabled = values[idx].enabled ? true : false;
            });
            return values;
        }
    });

    /**
     * Channel count query with RestAPI call
     */
    const { data: count, isLoading: isCountLoading } = useQuery<number>({
        queryKey: ["channelscount", lazyState],
        queryFn: async () => {
            const filters = encodeURIComponent(JSON.stringify(lazyState.filters));
            const res = await fetch(`/api/admin/crud/channels/count?filter=${filters}`);
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
     * React hook form submition error handler
     * @param errors errors
     */
    const onSubmitError = (errors: FieldErrors<FormValues>) => {
        //console.log(errors);
        show("error", "Please fill form as needed. Read tooltips on red marked fields.");
    }

    /**
     * React hook form submit callback. Use for create and update RestAPI calls
     * 
     * @param data submited data values
     */
    const onSubmit = (data: FormValues) => {
        const params = {
            energy_meter_id: data.energy_meter_id,
            channel: data.channel,
            channel_name: data.channel_name,
            enabled: data.enabled,
        };
        if (editedRow && editedRow.id) {
            fetch('/api/admin/crud/channels/' + editedRow.id, {
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
                show("success", `Updated channel: ${JSON.stringify(data)}`);
            }).catch((err) => show("error", err));
        } else {
            fetch('/api/admin/crud/channels', {
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
                show('success', `Saved channel: ${JSON.stringify(data)}`);
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
     * Power meter values state hook
     */
    const [energy_meterValues, setEnergy_meterValues] = useState<EnergyMeterValues[]>([]);
    /**
     * Power meter values fetch
     */
    const fetchEnergy_meterValues = async () => {
        let response = await fetch('/api/admin/crud/energy_meter');
        let data = await response.json();
        setEnergy_meterValues(data);
    }

    /**
     * EditedRow useEffect
     */
    useEffect(() => {
        //console.log(selectedRows);
        fetchEnergy_meterValues();
        if (editedRow && editedRow.id) {
            setValue("energy_meter_id", editedRow.energy_meter_id);
            setValue("channel", editedRow.channel);
            setValue("channel_name", editedRow.channel_name);
            setValue("enabled", editedRow.enabled ? true : false);
        } else {
            setValue("energy_meter_id", -1);
            setValue("channel", 1);
            setValue("channel_name", '');
            setValue("enabled", false);
        }
    }, [editedRow, setValue]);

    /**
     * Delete selected powermeter with RestAPI
     */
    const deleteSelectedRow = () => {
        if (selectedRow) {
            fetch('/api/admin/crud/channels/' + selectedRow.id, {
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
                show("success", `Deleted channels: ${JSON.stringify(data)}`);
                updatePage();
            }).catch((err) => show("error", err));
        }
    }

    /**
     * DataTable reference
     */
    const dt = useRef<DataTable<DataTableValueArray>>(null);

    /**
     * Export measurements data to CSV
     * @param selectionOnly export only selected data 
     */
    const exportCSV = async (selectionOnly: boolean) => {
        //dt.current.exportCSV({ selectionOnly });
        let result = await fetch("/api/admin/crud/channels");
        let data = await result.json();
        let csv = convertToCSV(data);
        downloadCSVFile(csv, "download.csv");
    };

    const header = (
        <div className="flex align-items-center justify-content-end gap-2">
            <Button type="button" icon="pi pi-file" rounded onClick={() => exportCSV(false)} data-pr-tooltip="CSV" />
        </div>
    );

    return (
        <div className="card">
            <h2>Channels</h2>
            <Toast ref={toast} />
            <Dialog header="channels" visible={visible} onHide={() => setVisible(false)} style={{ width: '50vw' }}>
                <form onSubmit={handleSubmit(onSubmit, onSubmitError)} style={{ width: '100%' }}>
                    <Controller
                        name="energy_meter_id"
                        control={control}
                        rules={{ required: 'Energy meter is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>Energy meter: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <Dropdown id={field.name} tooltip={errors.energy_meter_id?.message} className={classNames({ 'p-invalid': fieldState.invalid })} value={field.value} onChange={(event) => field.onChange(event.target.value)} options={energy_meterValues} optionLabel="asset_name" optionValue="id" placeholder="Select Energy meter" style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <Controller
                        name="channel"
                        control={control}
                        rules={{ required: 'channel is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>Channel: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <InputNumber id={field.name} value={field.value || 0} tooltip={errors.channel?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onValueChange={(event) => field.onChange((event.target.value as number))} style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <Controller
                        name="channel_name"
                        control={control}
                        rules={{ required: 'channel_name is required.' }}
                        render={({ field, fieldState }) => (
                            <>
                                <div className="grid align-items-baseline">
                                    <div className="col-12 mb-2 md:col-2 md:mb-0">
                                        <label htmlFor={field.name}>Channel name: </label>
                                    </div>
                                    <div className="col-12 md:col-10">
                                        <InputText id={field.name} value={field.value || ''} tooltip={errors.channel_name?.message} className={classNames({ 'p-invalid': fieldState.invalid })} onChange={field.onChange} style={{ width: '100%' }} />
                                    </div>
                                </div>
                            </>
                        )}
                    />
                    <Controller
                        name="enabled"
                        control={control}
                        rules={{ required: 'enabled is required.' }}
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
                <DataTable value={channelsValues}
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
                    <Column field="assset_name" header="Energy meter name"></Column>
                    <Column field="channel" header="Channel"></Column>
                    <Column field="channel_name" header="Channel Name"></Column>
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
                    setVisible(true);
                }} disabled={selectedRow && selectedRow.id ? false : true} />
                <Button label="Delete" icon="pi pi-check" onClick={() => setConfirmDialogVisible(true)} disabled={selectedRow && selectedRow.id ? false : true} />
            </div>
        </div>
    )
}

export default Channels;

