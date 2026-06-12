import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const generateInvoice = (order) => {
  return new Promise((resolve, reject) => {
    const invoiceDir = path.join(__dirname, "../uploads/invoices");
    if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });
    const fileName = `invoice-${order.orderNumber}.pdf`;
    const filePath = path.join(invoiceDir, fileName);
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    doc.fontSize(24).font("Helvetica-Bold").text("FURNITURE STORE", 50, 50);
    doc.fontSize(10).font("Helvetica").text("Premium Furniture & Home Decor", 50, 80);
    doc.fontSize(18).font("Helvetica-Bold").text("INVOICE", { align: "right" });
    doc.fontSize(10).font("Helvetica").text(`Order: ${order.orderNumber}`, { align: "right" }).text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`, { align: "right" });
    doc.moveDown(2);
    doc.fontSize(12).font("Helvetica-Bold").text("Ship To:");
    doc.fontSize(10).font("Helvetica").text(order.shippingAddress.name).text(order.shippingAddress.street).text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`).text(order.shippingAddress.phone);
    doc.moveDown(2);
    const tableTop = doc.y;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Item", 50, tableTop).text("Qty", 300, tableTop).text("Price", 370, tableTop).text("Total", 450, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    let y = tableTop + 25;
    doc.font("Helvetica").fontSize(9);
    order.items.forEach((item) => {
      doc.text(item.name, 50, y, { width: 240 }).text(item.quantity.toString(), 300, y).text(`₹${item.price.toFixed(2)}`, 370, y).text(`₹${(item.price * item.quantity).toFixed(2)}`, 450, y);
      y += 25;
    });
    doc.moveTo(50, y).lineTo(550, y).stroke(); y += 15;
    doc.font("Helvetica").text("Items Total:", 350, y).text(`₹${order.itemsPrice.toFixed(2)}`, 450, y); y += 18;
    doc.text("Shipping:", 350, y).text(`₹${order.shippingPrice.toFixed(2)}`, 450, y); y += 18;
    doc.text("Tax (GST):", 350, y).text(`₹${order.taxPrice.toFixed(2)}`, 450, y); y += 18;
    doc.font("Helvetica-Bold").fontSize(12).text("Grand Total:", 350, y).text(`₹${order.totalPrice.toFixed(2)}`, 450, y);
    doc.moveDown(3).fontSize(9).font("Helvetica").text("Thank you for shopping with us!", { align: "center" });
    doc.end();
    writeStream.on("finish", () => resolve(`/uploads/invoices/${fileName}`));
    writeStream.on("error", reject);
  });
};