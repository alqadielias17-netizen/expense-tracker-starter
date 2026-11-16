const API_URL = "http://localhost:3000/api/expenses";
const INCOME_API_URL = "http://localhost:3000/api/incomes";

let allExpenses = [];
let allIncomes = [];
let expenseToDelete = null;
let deleteRecordType = "expense";

const expenseForm = document.getElementById("expenseForm");
const editExpenseForm = document.getElementById("editExpenseForm");
const categoryFilter = document.getElementById("categoryFilter");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");
const monthFilter = document.getElementById("monthFilter");
const exportCsvButton = document.getElementById("exportCsvButton");
const themeToggleButton = document.getElementById("themeToggleButton");
let sortColumn = "";
let sortDirection = "asc";
let currentTransactionType = "expense";
const expensesTab = document.getElementById("expensesTab");
const incomesTab = document.getElementById("incomesTab");
let currentTableType = "expense";

const showExpenseFormButton = document.getElementById("showExpenseForm");
const showIncomeFormButton = document.getElementById("showIncomeForm");

function switchTransactionType(type) {
    currentTransactionType = type;

    const isIncome = type === "income";
    document.getElementById("transactionFormTitle").textContent =
        isIncome ? "Add Income" : "Add Expense";

    document.getElementById("title").placeholder =
        isIncome ? "Enter income title" : "Enter expense title";

    const categorySelect = document.getElementById("category");
    const categories = isIncome
        ? ["Salary", "Business", "Investment", "Other"]
        : ["Food", "Transport", "Bills", "Entertainment", "Other"];

    categorySelect.replaceChildren(
        new Option("Select a category", ""),
        ...categories.map((category) => new Option(category, category))
    );

    showIncomeFormButton.className = isIncome
        ? "btn btn-success"
        : "btn btn-outline-success";

    showExpenseFormButton.className = isIncome
        ? "btn btn-outline-primary"
        : "btn btn-primary";

    expenseForm.querySelector('[type="submit"]').innerHTML = isIncome
        ? '<i class="bi bi-plus-lg me-1"></i>Add Income'
        : '<i class="bi bi-plus-lg me-1"></i>Add Expense';
}

showExpenseFormButton.addEventListener("click", () => {
    switchTransactionType("expense");
});

showIncomeFormButton.addEventListener("click", () => {
    switchTransactionType("income");
});


function getFilteredExpenses() {
    const selectedCategory = categoryFilter.value;
    const selectedMonth = monthFilter.value;

    return allExpenses.filter((expense) => {
        const matchesCategory =
            selectedCategory === "All" ||
            expense.category === selectedCategory;
        //month
        const expenseMonth = String(expense.date).slice(5, 7);

        const matchesMonth =
            selectedMonth === "" ||
            expenseMonth === selectedMonth;

        return matchesCategory && matchesMonth;
    });
}
function getFilteredIncomes() {
    const selectedCategory = categoryFilter.value;
    const selectedMonth = monthFilter.value;

    return allIncomes.filter((income) => {
        const matchesCategory =
            selectedCategory === "All" ||
            income.category === selectedCategory;

        const incomeMonth = String(income.date).slice(5, 7);
        const matchesMonth =
            selectedMonth === "" ||
            incomeMonth === selectedMonth;

        return matchesCategory && matchesMonth;
    });
}

function displayIncomes(incomes) {
    const tableBody = document.getElementById("expensesTableBody");
    tableBody.innerHTML = "";

    incomes.forEach((income) => {
        const row = document.createElement("tr");

        [income.title, Number(income.amount).toFixed(2), income.category, income.date]
            .forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

        const actionsCell = document.createElement("td");
        const editButton = createActionButton("Edit", "btn-warning me-1", () => {
            document.getElementById("editId").value = income.id;
            document.getElementById("editTitle").value = income.title;
            document.getElementById("editAmount").value = income.amount;
            document.getElementById("editCategory").value = income.category;
            document.getElementById("editDate").value = income.date;

            document.getElementById("editCategory").innerHTML = `
        <option value="Salary">Salary</option>
        <option value="Business">Business</option>
        <option value="Investment">Investment</option>
        <option value="Other">Other</option>
    `;

            document.getElementById("editCategory").value = income.category;

            const modal = bootstrap.Modal.getOrCreateInstance(
                document.getElementById("editExpenseModal")
            );
            modal.show();
        });

        actionsCell.appendChild(editButton);

        const deleteButton = createActionButton(
            "Delete",
            "btn-danger",
            () => openDeleteConfirmation(income.id, "income")
        );

        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell);
        tableBody.appendChild(row);
    });

    const total = incomes.reduce(
        (sum, income) => sum + Number(income.amount),
        0
    );

    document.getElementById("filteredCount").textContent =
        `${incomes.length} Incomes`;

    document.getElementById("filteredTotal").textContent = total.toFixed(2);
}
function displaySelectedTable() {
    const isIncome = currentTableType === "income";
    const tableBody = document.getElementById("expensesTableBody");

    if (isIncome) {
        displayIncomes(getFilteredIncomes());
    } else {
        displayExpenses(sortExpenses(getFilteredExpenses()));
    }

    expensesTab.className = isIncome
        ? "btn btn-outline-primary"
        : "btn btn-primary";

    incomesTab.className = isIncome
        ? "btn btn-success"
        : "btn btn-outline-success";

    tableBody.closest("table").querySelector("thead").className =
        isIncome ? "table-success" : "table-dark";
}

expensesTab.addEventListener("click", () => {
    currentTableType = "expense";
    displaySelectedTable();
});

incomesTab.addEventListener("click", () => {
    currentTableType = "income";
    displaySelectedTable();
});
// value to month or category
function escapeCsvValue(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
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
function exportExpensesToCsv() {
    const rows = [
        ...allExpenses.map((item) => ({
            ...item,
            type: "Expense",
        })),
        ...allIncomes.map((item) => ({
            ...item,
            type: "Income",
        })),
    ];

    if (rows.length === 0) {
        showAlert(
            "warning",
            "There are no records to export.",
            "tableAlertContainer"
        );
        return;
    }

    const csvRows = [
        ["Type", "Title", "Amount", "Category", "Date"],
        ...rows.map((item) => [
            item.type,
            item.title,
            Number(item.amount).toFixed(2),
            item.category,
            item.date,
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
    downloadLink.download = "personal-finance-report.csv";

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
    }, 6000);
}

function updateSummaryCards(expenses, incomes = []) {
    const totalExpenses = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0
    );

    const highestExpense =
        expenses.length > 0
            ? Math.max(...expenses.map((expense) => Number(expense.amount)))
            : 0;

    const totalIncome = incomes.reduce(
        (sum, income) => sum + Number(income.amount),
        0
    );

    document.getElementById("totalExpenses").textContent =
        totalExpenses.toFixed(2);

    document.getElementById("expenseCount").textContent = expenses.length;

    document.getElementById("highestExpense").textContent =
        highestExpense.toFixed(2);

    document.getElementById("totalIncome").textContent =
        totalIncome.toFixed(2);

    document.getElementById("netBalance").textContent =
        (totalIncome - totalExpenses).toFixed(2);
}

async function getExpenses() {
    const spinner = document.getElementById("spinner");

    if (spinner) {
        spinner.classList.remove("d-none");
    }

    try {
        const response = await fetch(API_URL, { credentials: "include" });

        if (!response.ok) {
            const message = await getResponseError(response, "Failed to load expenses.");
            throw new Error(message);
        }
        allExpenses = await response.json();

        const incomeResponse = await fetch(INCOME_API_URL, { credentials: "include" });

        if (!incomeResponse.ok) {
            const message = await getResponseError(
                incomeResponse,
                "Failed to load income."
            );
            throw new Error(message);
        }

        allIncomes = await incomeResponse.json();
        renderMonthlyReport();
        updateSummaryCards(allExpenses, allIncomes);
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

        const editButton = createActionButton("Edit", "btn-warning me-1", () => editExpense(expense.id));

        const deleteButton = createActionButton("Delete", "btn-danger", () => deleteExpense(expense.id));

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

    document.getElementById("filteredCount").textContent = `${expenses.length} Expenses`;

    document.getElementById("filteredTotal").textContent = filteredTotal.toFixed(2);
}

function applyFilter() {
    displaySelectedTable();
}

function renderCategoryChart(expenses, containerId = "categoryChart") {
    const chartContainer = document.getElementById(containerId);

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
        chartContainer.innerHTML = '<p class="text-muted mb-0">No records available to display.</p>';
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
function renderMonthlyReport() {
    renderCategoryChart(allIncomes, "monthlyReport");
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
// prefix for edit 
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

    const isIncome = currentTransactionType === "income";
    const selectedApiUrl = isIncome ? INCOME_API_URL : API_URL;
    const recordName = isIncome ? "income" : "expense";

    try {
        const response = await fetch(selectedApiUrl, {
            method: "POST",
            credentials: "include",
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
                `Failed to add ${recordName}.`
            );
            throw new Error(`${message} (HTTP ${response.status})`);
        }

        expenseForm.reset();

        showAlert(
            "success",
            `${isIncome ? "Income" : "Expense"} added successfully.`,
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

function openDeleteConfirmation(id, type) {
    expenseToDelete = id;
    deleteRecordType = type;

    document.getElementById("deleteConfirmationText").textContent =
        type === "income"
            ? "Are you sure you want to delete this income record?"
            : "Are you sure you want to delete this expense?";

    const modalElement = document.getElementById("deleteExpenseModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();
}

function deleteExpense(id) {
    openDeleteConfirmation(id, "expense");
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

    const isIncome = deleteRecordType === "income";
    const selectedApiUrl = isIncome ? INCOME_API_URL : API_URL;
    const recordName = isIncome ? "income" : "expense";
    const modal = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("deleteExpenseModal")
    );

    try {
        const response = await fetch(`${selectedApiUrl}/${expenseToDelete}`, {
            method: "DELETE",
            credentials: "include",
        });

        if (!response.ok) {
            const message = await getResponseError(
                response,
                `Failed to delete ${recordName}.`
            );
            throw new Error(message);
        }

        modal.hide();
        expenseToDelete = null;
        deleteRecordType = "expense";

        showAlert(
            "success",
            `${isIncome ? "Income" : "Expense"} deleted successfully.`,
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
        const editApiUrl =
    currentTableType === "income" ? INCOME_API_URL : API_URL;

const response = await fetch(`${editApiUrl}/${id}`, {
            method: "PUT",
            credentials: "include",
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
        //the same column is clicked
        if (sortColumn === selectedColumn) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            // new column is clicked, set to ascending order
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
function getLocalToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

const today = getLocalToday();

dateInput.max = today;
document.getElementById("editDate").max = today;
const openDatePickerButton = document.getElementById("openDatePickerButton");

openDatePickerButton.addEventListener("click", () => {
    if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
    } else {
        dateInput.focus();
        dateInput.click();
    }
});
document.getElementById("categoryChartTab").addEventListener("click", () => {
    document.getElementById("categoryChart").classList.remove("d-none");
    document.getElementById("monthlyReport").classList.add("d-none");
    document.getElementById("chartTitle").textContent = "Expenses by Category";
    document.getElementById("categoryChartTab").className = "btn btn-primary";
document.getElementById("monthlyChartTab").className = "btn btn-outline-primary";
});

document.getElementById("monthlyChartTab").addEventListener("click", () => {
    document.getElementById("categoryChart").classList.add("d-none");
    document.getElementById("monthlyReport").classList.remove("d-none");
    document.getElementById("chartTitle").textContent = "Income by Category";
    document.getElementById("monthlyChartTab").className = "btn btn-primary";
document.getElementById("categoryChartTab").className = "btn btn-outline-primary";
    renderMonthlyReport();
});

let authMode = "login";

const authForm = document.getElementById("authForm");
const authSection = document.getElementById("authSection");
const appContent = document.getElementById("appContent");
const signedInUser = document.getElementById("signedInUser");
const logoutButton = document.getElementById("logoutButton");
const confirmPasswordGroup = document.getElementById("confirmPasswordGroup");
const confirmPasswordInput = document.getElementById("authConfirmPassword");

function showSignedInUser(email) {
    signedInUser.textContent = email;
    signedInUser.classList.remove("d-none");
    logoutButton.classList.remove("d-none");
}

function showSignInForm() {
    signedInUser.classList.add("d-none");
    logoutButton.classList.add("d-none");
    appContent.classList.add("d-none");
    authSection.classList.remove("d-none");
}

document.getElementById("loginModeButton").addEventListener("click", () => {
    authMode = "login";
    document.getElementById("authTitle").textContent = "Sign in";
    document.getElementById("authSubmitButton").textContent = "Sign in";

    document.getElementById("loginModeButton").className = "btn btn-primary";
    document.getElementById("registerModeButton").className =
        "btn btn-outline-primary";

    confirmPasswordGroup.classList.add("d-none");
    confirmPasswordInput.required = false;
    confirmPasswordInput.value = "";
});

document.getElementById("registerModeButton").addEventListener("click", () => {
    authMode = "register";
    document.getElementById("authTitle").textContent = "Create account";
    document.getElementById("authSubmitButton").textContent = "Create account";

    document.getElementById("registerModeButton").className = "btn btn-primary";
    document.getElementById("loginModeButton").className =
        "btn btn-outline-primary";

    confirmPasswordGroup.classList.remove("d-none");
    confirmPasswordInput.required = true;
});

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
    authMode === "register" &&
    document.getElementById("authPassword").value !== confirmPasswordInput.value
) {
    const message = document.getElementById("authMessage");
    message.textContent = "Passwords do not match.";
    message.className = "alert alert-danger";
    return;
}

    const endpoint = authMode === "register" ? "register" : "login";

    try {
        const response = await fetch(
            `http://localhost:3000/api/auth/${endpoint}`,
            {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: document.getElementById("authEmail").value.trim(),
                    password: document.getElementById("authPassword").value
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Sign-in failed.");
        }

        authSection.classList.add("d-none");
        appContent.classList.remove("d-none");
        showSignedInUser(data.user.email);
        await getExpenses();
    } catch (error) {
        const message = document.getElementById("authMessage");
        message.textContent = error.message;
        message.className = "alert alert-danger";
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await fetch("http://localhost:3000/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });

        showSignInForm();
    } catch {
        alert("Could not sign out. Please try again.");
    }
});

async function checkAuthentication() {
    try {
        const response = await fetch("http://localhost:3000/api/auth/me", {
            credentials: "include"
        });

        if (!response.ok) return;

        const data = await response.json();
        authSection.classList.add("d-none");
        appContent.classList.remove("d-none");
        showSignedInUser(data.user.email);
        await getExpenses();
    } catch (error) {
        console.error("Could not check sign-in session:", error);
    }
}

checkAuthentication();

