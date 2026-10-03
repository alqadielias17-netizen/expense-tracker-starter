const API_URL = "http://localhost:3000/api/expenses";

let allExpenses = [];
let expenseToDelete = null;

const expenseForm = document.getElementById("expenseForm");
const editExpenseForm = document.getElementById("editExpenseForm");
const categoryFilter = document.getElementById("categoryFilter");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");
const monthFilter = document.getElementById("monthFilter");
let sortColumn = "";
let sortDirection = "asc";
const exportCsvButton = document.getElementById("exportCsvButton");
const themeToggleButton = document.getElementById("themeToggleButton");

function getFilteredExpenses() {
    const selectedCategory = categoryFilter.value;
    const selectedMonth = monthFilter.value;

    return allExpenses.filter((expense) => {
        const matchesCategory =
            selectedCategory === "All" ||
            expense.category === selectedCategory;

        const expenseMonth = String(expense.date).slice(5, 7);

        const matchesMonth =
            selectedMonth === "" ||
            expenseMonth === selectedMonth;

        return matchesCategory && matchesMonth;
    });
}

function escapeCsvValue(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

function exportExpensesToCsv() {
    const filteredExpenses = getFilteredExpenses();
    const sortedExpenses = sortExpenses(filteredExpenses);

    if (sortedExpenses.length === 0) {
        showAlert(
            "warning",
            "There are no expenses to export.",
            "tableAlertContainer"
        );
        return;
    }

    const csvRows = [
        ["Title", "Amount", "Category", "Date"],
        ...sortedExpenses.map((expense) => [
            expense.title,
            Number(expense.amount).toFixed(2),
            expense.category,
            expense.date,
        ]),
    ];

    const csvContent = csvRows
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\n");

    const csvFile = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
    });

    const downloadUrl = URL.createObjectURL(csvFile);
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = "expenses.csv";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    URL.revokeObjectURL(downloadUrl);
}

function getErrorMessage(error) {
    return error.name === "TypeError"
        ? "Unable to connect to the server. Please make sure the server is running."
        : error.message;
}

async function getResponseError(response, defaultMessage) {
    try {
        const errorData = await response.json();
        return errorData.message || defaultMessage;
    } catch {
        return defaultMessage;
    }
}

function showAlert(type, message, containerId) {
    const container = document.getElementById(containerId);

    if (!container) {
        return;
    }

    container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button
        type="button"
        class="btn-close"
        data-bs-dismiss="alert"
        aria-label="Close"
      ></button>
    </div>
  `;

    setTimeout(() => {
        container.innerHTML = "";
    }, 3000);
}

function updateSummaryCards(expenses) {
    const totalExpenses = expenses.reduce((sum, expense) => {
        return sum + Number(expense.amount);
    }, 0);

    const highestExpense =
        expenses.length > 0
            ? Math.max(...expenses.map((expense) => Number(expense.amount)))
            : 0;

    document.getElementById("totalExpenses").textContent =
        totalExpenses.toFixed(2);

    document.getElementById("expenseCount").textContent = expenses.length;

    document.getElementById("highestExpense").textContent =
        highestExpense.toFixed(2);
}

async function getExpenses() {
    const spinner = document.getElementById("spinner");

    if (spinner) {
        spinner.classList.remove("d-none");
    }

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            const message = await getResponseError(
                response,
                "Failed to load expenses."
            );

            throw new Error(message);
        }

        allExpenses = await response.json();

        updateSummaryCards(allExpenses);
        applyFilter();
        renderCategoryChart(allExpenses);
    } catch (error) {
        showAlert("danger", getErrorMessage(error), "tableAlertContainer");
    } finally {
        if (spinner) {
            spinner.classList.add("d-none");
        }
    }
}

function createActionButton(label, buttonClass, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `btn ${buttonClass} btn-sm`;
    button.textContent = label;
    button.addEventListener("click", onClick);

    return button;
}

function displayExpenses(expenses) {
    const tableBody = document.getElementById("expensesTableBody");
    tableBody.innerHTML = "";

    expenses.forEach((expense) => {
        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = expense.title;

        const amountCell = document.createElement("td");
        amountCell.textContent = Number(expense.amount).toFixed(2);

        const categoryCell = document.createElement("td");
        const categoryBadge = document.createElement("span");
        categoryBadge.className = "badge bg-primary";
        categoryBadge.textContent = expense.category;
        categoryCell.appendChild(categoryBadge);

        const dateCell = document.createElement("td");
        dateCell.textContent = expense.date;

        const actionsCell = document.createElement("td");
        actionsCell.className = "text-md-end";

        const editButton = createActionButton(
            "Edit",
            "btn-warning me-1",
            () => editExpense(expense.id)
        );

        const deleteButton = createActionButton(
            "Delete",
            "btn-danger",
            () => deleteExpense(expense.id)
        );

        actionsCell.append(editButton, deleteButton);

        row.append(
            titleCell,
            amountCell,
            categoryCell,
            dateCell,
            actionsCell
        );

        tableBody.appendChild(row);
    });

    const filteredTotal = expenses.reduce((sum, expense) => {
        return sum + Number(expense.amount);
    }, 0);

    document.getElementById("filteredCount").textContent =
        `${expenses.length} Expenses`;

    document.getElementById("filteredTotal").textContent =
        filteredTotal.toFixed(2);
}
function sortExpenses(expenses) {
    if (!sortColumn) {
        return expenses;
    }

    return [...expenses].sort((firstExpense, secondExpense) => {
        let firstValue = firstExpense[sortColumn];
        let secondValue = secondExpense[sortColumn];

        if (sortColumn === "amount") {
            firstValue = Number(firstValue);
            secondValue = Number(secondValue);

            return sortDirection === "asc"
                ? firstValue - secondValue
                : secondValue - firstValue;
        }

        firstValue = String(firstValue).toLowerCase();
        secondValue = String(secondValue).toLowerCase();

        return sortDirection === "asc"
            ? firstValue.localeCompare(secondValue)
            : secondValue.localeCompare(firstValue);
    });
}

function applyFilter() {
    const filteredExpenses = getFilteredExpenses();
    const sortedExpenses = sortExpenses(filteredExpenses);

    displayExpenses(sortedExpenses);
}

function renderCategoryChart(expenses) {
    const chartContainer = document.getElementById("categoryChart");

    if (!chartContainer) {
        return;
    }

    const totalsByCategory = expenses.reduce((totals, expense) => {
        const category = expense.category;
        const amount = Number(expense.amount);

        totals[category] = (totals[category] || 0) + amount;

        return totals;
    }, {});

    const categoryEntries = Object.entries(totalsByCategory);

    chartContainer.innerHTML = "";

    if (categoryEntries.length === 0) {
        chartContainer.innerHTML =
            '<p class="text-muted mb-0">No expenses available to display.</p>';

        return;
    }

    const highestTotal = Math.max(
        ...categoryEntries.map(([, total]) => total)
    );

    categoryEntries.forEach(([category, total]) => {
        const barHeight = (total / highestTotal) * 100;

        const chartColumn = document.createElement("div");
        chartColumn.className = "chart-column";

        const chartValue = document.createElement("span");
        chartValue.className = "chart-value";
        chartValue.textContent = total.toFixed(2);

        const chartBar = document.createElement("div");
        chartBar.className = "chart-bar";
        chartBar.style.height = `${barHeight}%`;

        const categoryLabel = document.createElement("span");
        categoryLabel.className = "chart-label";
        categoryLabel.textContent = category;

        chartColumn.append(chartValue, chartBar, categoryLabel);
        chartContainer.appendChild(chartColumn);
    });
}

function clearAddFormErrors() {
    document.getElementById("titleError").textContent = "";
    document.getElementById("amountError").textContent = "";
    document.getElementById("categoryError").textContent = "";
    document.getElementById("dateError").textContent = "";
}

function clearEditFormErrors() {
    document.getElementById("editTitleError").textContent = "";
    document.getElementById("editAmountError").textContent = "";
    document.getElementById("editCategoryError").textContent = "";
    document.getElementById("editDateError").textContent = "";
}

function validateExpense(title, amount, category, date, prefix = "") {
    let isValid = true;

    const titleError = document.getElementById(`${prefix}TitleError`);
    const amountError = document.getElementById(`${prefix}AmountError`);
    const categoryError = document.getElementById(`${prefix}CategoryError`);
    const dateError = document.getElementById(`${prefix}DateError`);

    if (!title) {
        titleError.textContent = "Title is required.";
        isValid = false;
    }

    if (!amount || Number(amount) <= 0) {
        amountError.textContent = "Amount must be greater than zero.";
        isValid = false;
    }

    if (!category) {
        categoryError.textContent = "Please select a category.";
        isValid = false;
    }

    if (!date) {
        dateError.textContent = "Date is required.";
        isValid = false;
    }

    return isValid;
}

expenseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAddFormErrors();

    const title = document.getElementById("title").value.trim();
    const amount = document.getElementById("amount").value;
    const category = document.getElementById("category").value;
    const date = document.getElementById("date").value;

    if (!validateExpense(title, amount, category, date)) {
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title,
                amount: Number(amount),
                category,
                date,
            }),
        });

        if (!response.ok) {
            const message = await getResponseError(
                response,
                "Failed to add expense."
            );

            throw new Error(message);
        }

        expenseForm.reset();

        showAlert(
            "success",
            "Expense added successfully.",
            "formAlertContainer"
        );

        await getExpenses();
    } catch (error) {
        showAlert("danger", getErrorMessage(error), "formAlertContainer");
    }
});

function editExpense(id) {
    const expense = allExpenses.find(
        (currentExpense) => String(currentExpense.id) === String(id)
    );

    if (!expense) {
        return;
    }

    document.getElementById("editId").value = expense.id;
    document.getElementById("editTitle").value = expense.title;
    document.getElementById("editAmount").value = expense.amount;
    document.getElementById("editCategory").value = expense.category;
    document.getElementById("editDate").value = expense.date;

    clearEditFormErrors();

    const modalElement = document.getElementById("editExpenseModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.show();
}

function deleteExpense(id) {
    expenseToDelete = id;

    const modalElement = document.getElementById("deleteExpenseModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.show();
}
function updateThemeButton() {
    const isDarkMode = document.body.classList.contains("dark-mode");

    themeToggleButton.innerHTML = isDarkMode
        ? '<i class="bi bi-sun-fill"></i> Light Mode'
        : '<i class="bi bi-moon-stars-fill"></i> Dark Mode';
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    updateThemeButton();
}

themeToggleButton.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    const selectedTheme = document.body.classList.contains("dark-mode")
        ? "dark"
        : "light";

    localStorage.setItem("theme", selectedTheme);
    updateThemeButton();
});

loadSavedTheme();

confirmDeleteButton.addEventListener("click", async () => {
    if (expenseToDelete === null) {
        return;
    }

    const modalElement = document.getElementById("deleteExpenseModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    try {
        const response = await fetch(`${API_URL}/${expenseToDelete}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const message = await getResponseError(
                response,
                "Failed to delete expense."
            );

            throw new Error(message);
        }

        modal.hide();
        expenseToDelete = null;

        showAlert(
            "success",
            "Expense deleted successfully.",
            "tableAlertContainer"
        );

        await getExpenses();
    } catch (error) {
        modal.hide();
        showAlert("danger", getErrorMessage(error), "tableAlertContainer");
    }
});

editExpenseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearEditFormErrors();

    const id = document.getElementById("editId").value;
    const title = document.getElementById("editTitle").value.trim();
    const amount = document.getElementById("editAmount").value;
    const category = document.getElementById("editCategory").value;
    const date = document.getElementById("editDate").value;

    if (!validateExpense(title, amount, category, date, "edit")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title,
                amount: Number(amount),
                category,
                date,
            }),
        });

        if (!response.ok) {
            const message = await getResponseError(
                response,
                "Failed to update expense."
            );

            throw new Error(message);
        }

        const modalElement = document.getElementById("editExpenseModal");
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

        modal.hide();

        showAlert(
            "success",
            "Expense updated successfully.",
            "tableAlertContainer"
        );

        await getExpenses();
    } catch (error) {
        showAlert("danger", getErrorMessage(error), "tableAlertContainer");
    }
});
document.querySelectorAll(".sortable-column").forEach((column) => {
    column.addEventListener("click", () => {
        const selectedColumn = column.dataset.sort;

        if (sortColumn === selectedColumn) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortColumn = selectedColumn;
            sortDirection = "asc";
        }

        applyFilter();
    });
});

categoryFilter.addEventListener("change", applyFilter);
monthFilter.addEventListener("change", applyFilter);
exportCsvButton.addEventListener("click", exportExpensesToCsv);

const dateInput = document.getElementById("date");
const openDatePickerButton = document.getElementById("openDatePickerButton");

openDatePickerButton.addEventListener("click", () => {
    if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
    } else {
        dateInput.focus();
        dateInput.click();
    }
});
getExpenses();
