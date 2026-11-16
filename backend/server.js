const express = require("express");
const cors = require("cors");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");

require("dotenv").config();

const { Pool } = require("pg");

const app = express();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

app.use(cors({
    origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],
    credentials: true
}));

app.use(express.json());

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from .env");
}

app.use(session({
    store: new PgSession({
        pool: pool,
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

const allowedCategories = [
    "Food",
    "Transport",
    "Bills",
    "Entertainment",
    "Other"
];

const allowedIncomeCategories = [
    "Salary",
    "Business",
    "Investment",
    "Other"
];
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Please sign in first" });
    }

    next();
}
app.post("/api/auth/register", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password || password.length < 8) {
            return res.status(400).json({
                message: "Enter an email and a password of at least 8 characters"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash)
             VALUES ($1, $2)
             RETURNING id, email`,
            [email.trim().toLowerCase(), passwordHash]
        );

        req.session.userId = result.rows[0].id;

        res.status(201).json({ user: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "An account with this email already exists"
            });
        }

        console.error(error);
        res.status(500).json({ message: "Unable to create account" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(
            `SELECT id, email, password_hash
             FROM users
             WHERE email = $1`,
            [String(email || "").trim().toLowerCase()]
        );

        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
            return res.status(401).json({
                message: "Email or password is incorrect"
            });
        }

        req.session.userId = user.id;

        res.json({
            user: { id: user.id, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to sign in" });
    }
});
app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Not signed in" });
    }

    try {
        const result = await pool.query(
            `SELECT id, email FROM users WHERE id = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            req.session.destroy(() => {});
            return res.status(401).json({ message: "User not found" });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to check sign-in" });
    }
});

app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({ message: "Unable to sign out" });
        }

        res.clearCookie("connect.sid");
        res.json({ message: "Signed out successfully" });
    });
});
app.get("/api/hello", (req, res) => {
    res.json({
        message: "Hello from Express!"
    });
});

app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id,
                   title,
                   amount::float8 AS amount,
                   category,
                   to_char(date, 'YYYY-MM-DD') AS date
            FROM expenses
            WHERE user_id = $1
            ORDER BY id
        `, [req.session.userId]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load expenses" });
    }
});

app.get("/api/expenses/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(404).json({ message: "Expense not found" });
    }

    try {
        const result = await pool.query(`
            SELECT id,
                   title,
                   amount::float8 AS amount,
                   category,
                   to_char(date, 'YYYY-MM-DD') AS date
            FROM expenses
            WHERE id = $1 AND user_id = $2
        `, [id, req.session.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Unable to load expense" });
    }
});

app.post("/api/expenses", requireAuth, async (req, res) => {
    const { title, amount, category, date } = req.body;

    if (!title || amount === undefined || !category || !date) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({
            message: "Amount must be a number greater than zero"
        });
    }

    if (!allowedCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
    }

    const result = await pool.query(`
        INSERT INTO expenses (user_id, title, amount, category, date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, amount::float8 AS amount, category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [req.session.userId, title, amount, category, date]);

    res.status(201).json(result.rows[0]);
});

app.put("/api/expenses/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, amount, category, date } = req.body;

    if (isNaN(id)) {
        return res.status(404).json({ message: "Expense not found" });
    }

    if (!title || amount === undefined || !category || !date) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({
            message: "Amount must be a number greater than zero"
        });
    }

    if (!allowedCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
    }

    const result = await pool.query(`
        UPDATE expenses
        SET title = $1, amount = $2, category = $3, date = $4
        WHERE id = $5 AND user_id = $6
        RETURNING id, title, amount::float8 AS amount, category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [title, amount, category, date, id, req.session.userId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ message: "Expense not found" });
    }

    res.json(result.rows[0]);
});

app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(404).json({ message: "Expense not found" });
    }

    const result = await pool.query(`
        DELETE FROM expenses
        WHERE id = $1 AND user_id = $2
        RETURNING id, title, amount::float8 AS amount, category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [id, req.session.userId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ message: "Expense not found" });
    }

    res.json({
        message: "Expense deleted successfully",
        expense: result.rows[0]
    });
});

app.get("/api/incomes", requireAuth, async (req, res) => {
   const result = await pool.query(`
    SELECT id, title, amount::float8 AS amount, category,
           to_char(date, 'YYYY-MM-DD') AS date
    FROM incomes
    WHERE user_id = $1
    ORDER BY id
`, [req.session.userId]);
    res.json(result.rows);
});

app.post("/api/incomes", requireAuth, async (req, res) => {
    const { title, amount, category, date } = req.body;

    if (!title || amount === undefined || !category || !date) {
        return res.status(400).json({ message: "All fields are required" });
    }
    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ message: "Amount must be greater than zero" });
    }
    if (!allowedIncomeCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid income category" });
    }

    const result = await pool.query(`
        INSERT INTO incomes (user_id, title, amount, category, date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, amount::float8 AS amount, category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [req.session.userId, title, amount, category, date]);

    res.status(201).json(result.rows[0]);
});

app.put("/api/incomes/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, amount, category, date } = req.body;

    if (isNaN(id)) {
        return res.status(404).json({ message: "Income not found" });
    }
    if (!title || amount === undefined || !category || !date) {
        return res.status(400).json({ message: "All fields are required" });
    }
    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ message: "Amount must be greater than zero" });
    }
    if (!allowedIncomeCategories.includes(category)) {
        return res.status(400).json({ message: "Invalid income category" });
    }

    const result = await pool.query(`
        UPDATE incomes
        SET title = $1, amount = $2, category = $3, date = $4
        WHERE id = $5 AND user_id = $6
        RETURNING id, title, amount::float8 AS amount, category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [title, amount, category, date, id, req.session.userId   ]);

    if (result.rows.length === 0) {
        return res.status(404).json({ message: "Income not found" });
    }
    res.json(result.rows[0]);
});

app.delete("/api/incomes/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(404).json({ message: "Income not found" });
    }

    const result = await pool.query(`
        DELETE FROM incomes
        WHERE id = $1 AND user_id = $2
        RETURNING id, title, amount::float8 AS amount, category,
                  to_char(date, 'YYYY-MM-DD') AS date
    `, [id, req.session.userId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ message: "Income not found" });
    }
    res.json({ message: "Income deleted successfully", income: result.rows[0] });
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});