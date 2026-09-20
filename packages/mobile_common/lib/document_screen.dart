import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

class BusinessDocumentScreen extends StatelessWidget {
  const BusinessDocumentScreen({super.key, required this.document});
  final Map<String, dynamic> document;
  @override
  Widget build(BuildContext context) {
    final p = (document['payload'] as Map).cast<String, dynamic>();
    return Scaffold(
      appBar: AppBar(title: Text(p['title']?.toString() ?? 'Document')),
      body: PdfPreview(
        pdfFileName: '${document['number']}.pdf',
        allowPrinting: true,
        allowSharing: true,
        canChangeOrientation: false,
        canChangePageFormat: false,
        build: (format) async {
          final doc = pw.Document();
          String amount(Object? v) =>
              '${double.tryParse('$v')?.toStringAsFixed(2) ?? v ?? 0} ${p['currency'] ?? 'RWF'}';
          doc.addPage(
            pw.MultiPage(
              pageFormat: PdfPageFormat.a4,
              margin: const pw.EdgeInsets.all(36),
              build: (_) => [
                pw.Container(
                  color: PdfColor.fromHex('#FFF4DF'),
                  padding: const pw.EdgeInsets.all(24),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'Fida',
                        style: pw.TextStyle(
                          fontSize: 32,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 20),
                      pw.Text(
                        p['title']?.toString() ?? 'Document',
                        style: pw.TextStyle(
                          fontSize: 24,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 10),
                      pw.Text(document['number'].toString()),
                      pw.Text(
                        'Issued: ${p['issuedAt'] ?? document['issuedAt']}',
                      ),
                      pw.Text('Order: ${p['orderNumber']}'),
                    ],
                  ),
                ),
                pw.SizedBox(height: 20),
                pw.Text('From: ${p['issuer']}'),
                pw.Text('To: ${p['recipient']}'),
                if (p['merchantAddress'] != null)
                  pw.Text(p['merchantAddress'].toString()),
                if (p['paymentMethod'] != null)
                  pw.Text(
                    'Payment: ${p['paymentMethod']} / ${p['paymentStatus']}',
                  ),
                if (p['originalNumber'] != null)
                  pw.Text('Original: ${p['originalNumber']}'),
                pw.SizedBox(height: 24),
                pw.TableHelper.fromTextArray(
                  headers: ['Item', 'Qty', 'Unit price', 'Amount'],
                  data: [
                    for (final row in p['lines'] as List? ?? [])
                      [
                        row['description'],
                        row['quantity'],
                        amount(row['unitPrice']),
                        amount(row['amount']),
                      ],
                  ],
                  headerDecoration: const pw.BoxDecoration(
                    color: PdfColors.grey200,
                  ),
                  cellAlignment: pw.Alignment.centerLeft,
                  columnWidths: {
                    0: const pw.FlexColumnWidth(4),
                    1: const pw.FlexColumnWidth(1),
                    2: const pw.FlexColumnWidth(2),
                    3: const pw.FlexColumnWidth(2),
                  },
                ),
                pw.SizedBox(height: 20),
                for (final entry in [
                  ('Subtotal', 'subtotal'),
                  ('Discount', 'discount'),
                  ('Tax', 'tax'),
                  ('Delivery', 'deliveryFee'),
                  ('Service fee', 'serviceFee'),
                ])
                  if (p[entry.$2] != null)
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text(entry.$1),
                        pw.Text(amount(p[entry.$2])),
                      ],
                    ),
                pw.Divider(),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      'Total',
                      style: pw.TextStyle(
                        fontSize: 22,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                    pw.Text(
                      amount(p['total']),
                      style: pw.TextStyle(
                        fontSize: 22,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                pw.SizedBox(height: 28),
                pw.Text(
                  p['note']?.toString() ?? '',
                  style: const pw.TextStyle(
                    fontSize: 9,
                    color: PdfColors.grey700,
                  ),
                ),
              ],
            ),
          );
          return doc.save();
        },
      ),
    );
  }
}
