
import { state } from '../core/state.js';
// We can import plotPoints directly now that map.js is a module!
import { plotPoints } from './map.js';
import { showToast } from './ui.js';

console.log("TABLE MODULE LOADED");

let dataTable = null;

export function initTable() {
    console.log('App.initTable starting (Module)...');
    // Initial empty table
    const table = $('#dataTable');
    table.empty();
    // Add styling classes for striping, hover, and borders
    table.addClass('display cell-border stripe hover');

    dataTable = table.DataTable({
        data: [],
        columns: [{ title: "No Data" }],
        dom: 'Bfrtip',
        buttons: ['colvis'],
        responsive: true,
        language: {
            emptyTable: "No data available in table",
            zeroRecords: "No matching records found"
        }
    });
    console.log('App.initTable completed.');
}

export function updateTable(data) {
    console.log('App.updateTable called with data:', data ? data.length : 0);
    if (!dataTable) return;

    if (!data || data.length === 0) {
        dataTable.clear().draw();
        return;
    }

    const sample = data[0];

    // Generate columns from sample data
    const columns = Object.keys(sample).map(k => {
        if (k.startsWith('_')) {
            return {
                title: k,
                data: k,
                visible: false,
                searchable: false
            };
        }
        return {
            title: k,
            data: k,
            className: 'text-left align-top', // Force left alignment
            defaultContent: "<em>(empty)</em>",
            render: function (data, type, row) {
                return (data === null || data === undefined) ? "" : data;
            }
        };
    });

    if (!sample.hasOwnProperty('_lat') || !sample.hasOwnProperty('_lng')) {
        console.error('CRITICAL: Data passed to updateTable is missing _lat or _lng!', sample);
        showToast('Data missing coordinates. Check console.', 'error');
    }

    if (columns.length === 0) {
        console.warn('App.updateTable: No columns found');
        return;
    }

    // Destroy and re-init
    // Destroy and re-init
    if (dataTable) {
        dataTable.destroy();
        $('#dataTable').empty();
    }

    // Ensure classes persist
    $('#dataTable').addClass('display cell-border stripe hover');

    const table = $('#dataTable');

    // Initialize DataTable with ColumnControl
    dataTable = table.DataTable({
        data: data,
        columns: columns,
        paging: true,
        searching: true,
        ordering: true,
        fixedHeader: true,
        responsive: true,
        info: true,
        scrollY: '50vh',
        scrollCollapse: true,
        scrollX: true,
        scroller: false,
        columnControl: ['order', ['search', 'searchList']],
        // ordering: { indicators: false } -- Removed to restore default icons
        lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]] // removed autoWidth: false
    });

    // Re-attach listener
    dataTable.on('draw', function () {
        if (!state.isFilteringEnabled) {
            const filteredData = dataTable.rows({ search: 'applied' }).data().toArray();
            console.log('DataTable Draw - Filtered Data Count:', filteredData.length);

            state.filteredPoints = filteredData;
            plotPoints(filteredData);
        }
    });

    // Trigger initial plot
    if (!state.isFilteringEnabled) {
        const filteredData = dataTable.rows({ search: 'applied' }).data().toArray();
        console.log('Initial Table Load - Data Count:', filteredData.length);
        state.filteredPoints = filteredData;
        plotPoints(filteredData);
    }
}

export function adjustTableColumns() {
    if (dataTable) {
        // Recalculate column widths - essential when table becomes visible
        dataTable.columns.adjust().draw(false);
        console.log('Table columns adjusted.');
    }
}


