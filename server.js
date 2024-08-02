
const express = require("express");
const mongoose = require("mongoose");
const schedule = require("node-schedule");
const nodemailer = require("nodemailer");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(express.json());
const upload = multer();

// Database connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Email Job Schema
const jobSchema = new mongoose.Schema({
    recipient: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    time: { type: String, required: true },
    attachments: { type: Array, default: [] }
});

const Job = mongoose.model('Job', jobSchema);

// Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

// Function to send email
const sendEmail = async (to, subject, text, attachments) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
        attachments
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Email sent: ' + info.response);
    });
};

// Schedule existing jobs from DB
const scheduleJobs = async () => {
    const jobs = await Job.find();
    for (const job of jobs) {
        schedule.scheduleJob(job.time, async () => {
            await sendEmail(job.recipient, job.subject, job.body, job.attachments);
        });
    }
};
scheduleJobs();

// API Endpoints
app.post("/schedule-email", upload.array('attachments'), async (req, res) => {
    try {
        const { recipient, subject, body, time } = req.body;
        const attachments = req.files ? req.files.map(file => ({ filename: file.originalname, content: file.buffer })) : [];
        const job = new Job({ recipient, subject, body, time, attachments });
        await job.save();

        // Schedule the new job
        schedule.scheduleJob(time, async () => {
            await sendEmail(recipient, subject, body, attachments);
        });

        res.json({ message: "Email scheduled successfully", job });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get("/scheduled-emails", async (req, res) => {
    try {
        const jobs = await Job.find();
        res.json({ message: "Emails scheduled", jobs });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get("/scheduled-emails/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const job = await Job.findById(id);
        res.json({ message: "Email scheduled", job });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete("/scheduled-emails/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const job = await Job.findByIdAndDelete(id);
        res.json({ message: "Email unscheduled", job });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running on port " + process.env.PORT);
});

