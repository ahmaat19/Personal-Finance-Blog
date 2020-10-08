const express = require("express");
const morgan = require("morgan");
const connectDB = require("./config/db");

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => res.send("API Running"));

// Define Routes
app.use("/api/users", require("./routers/api/users"));
app.use("/api/auth", require("./routers/api/auth"));
app.use("/api/post", require("./routers/api/post"));

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
