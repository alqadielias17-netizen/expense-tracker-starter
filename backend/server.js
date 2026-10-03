const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

const allowedCategories = [
    "Food",
    "Transport",
    "Bills",
    "Entertainment",
    "Other"
];

app.get("/api/hello", (req, res) => {
    res.json({
        message: "Hello from Express!"
    });
});

app.get("/api/expenses", async (req, res) => {
    const result = await pool.query(`
        SELECT id,
               title,
               amount::float8 AS amount,
               category,
               to_char(date, 'YYYY-MM-DD') AS date
        FROM expenses
        ORDER BY id
    `);

    res.json(result.rows);
});

app.get("/api/expenses/:id", async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(404).json({
            message: "Expense not found"
        });
    }

    const result = await pool.query(`
        SELECT id,
               title,
               amount::float8 AS amount,
               category,
               to_char(date, 'YYYY-MM-DD') AS date
        FROM expenses
        WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
        return res.status(404).json({
            message: "Expense not found"
        });
    }

    res.json(result.rows[0]);
});

app.post("/api/expenses", async (req, res) => {
    const { title, amount, category, date } = req.body;

    if (!title || amount === undefined || !category || !date) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({
            message: "Amount must be a number greater than zero"
        });
    }

    if (!allowedCategories.includes(category)) {
        return res.status(400).json({
            message: "Invalid category"
        });
    }

    const result = await pool.query(`
        INSERT INTO expenses (title, amount, category, date)
        VALUES ($1, $2, $3, $4)
        RETURNING id,
                  title,
                  amount::float8 AS amount,
                  category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [title, amount, category, date]);

    res.status(201).json(result.rows[0]);
});

app.put("/api/expenses/:id", async (req, res) => {
    const { id } = req.params;
    const { title, amount, category, date } = req.body;

    if (isNaN(id)) {
        return res.status(404).json({
            message: "Expense not found"
        });
    }

    if (!title || amount === undefined || !category || !date) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({
            message: "Amount must be a number greater than zero"
        });
    }

    if (!allowedCategories.includes(category)) {
        return res.status(400).json({
            message: "Invalid category"
        });
    }

    const result = await pool.query(`
        UPDATE expenses
        SET title = $1,
            amount = $2,
            category = $3,
            date = $4
        WHERE id = $5
        RETURNING id,
                  title,
                  amount::float8 AS amount,
                  category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [title, amount, category, date, id]);

    if (result.rows.length === 0) {
        return res.status(404).json({
            message: "Expense not found"
        });
    }

    res.json(result.rows[0]);
});

app.delete("/api/expenses/:id", async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(404).json({
            message: "Expense not found"
        });
    }

    const result = await pool.query(`
        DELETE FROM expenses
        WHERE id = $1
        RETURNING id,
                  title,
                  amount::float8 AS amount,
                  category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [id]);

    if (result.rows.length === 0) {
        return res.status(404).json({
            message: "Expense not found"
        });
    }

    res.json({
        message: "Expense deleted successfully",
        expense: result.rows[0]
    });
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});