import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'core/session_controller.dart';
import 'screens/auth_screen.dart';
import 'screens/customer_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  final session = SessionController(api);
  runApp(FidaApp(api: api, session: session));
  session.initialize();
}

class FidaApp extends StatefulWidget {
  const FidaApp({super.key, required this.api, required this.session});

  final ApiClient api;
  final SessionController session;

  @override
  State<FidaApp> createState() => _FidaAppState();
}

class _FidaAppState extends State<FidaApp> {
  @override
  void dispose() {
    widget.api.close();
    widget.session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Fida Marketplace',
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF176B55),
        scaffoldBackgroundColor: const Color(0xFFF8FAF9),
        inputDecorationTheme: const InputDecorationTheme(filled: true),
        cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
      ),
      home: AnimatedBuilder(
        animation: widget.session,
        builder: (context, _) {
          if (widget.session.initializing) {
            return const _SplashScreen();
          }
          if (!widget.session.isAuthenticated) {
            return AuthScreen(session: widget.session);
          }
          return CustomerShell(api: widget.api, session: widget.session);
        },
      ),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.storefront_rounded, size: 78, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 18),
            Text(
              'Fida Marketplace',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 18),
            const SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2.5)),
          ],
        ),
      ),
    );
  }
}
