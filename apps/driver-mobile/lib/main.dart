import 'package:flutter/material.dart';

void main() => runApp(const FidaApp());

class FidaApp extends StatelessWidget {
  const FidaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Fida Marketplace',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: const Color(0xFF176B55)),
      home: const Scaffold(
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.delivery_dining_rounded, size: 72),
                SizedBox(height: 16),
                Text('Fida Marketplace', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                SizedBox(height: 8),
                Text('Driver app · Foundation build'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
