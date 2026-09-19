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
    const ink = Color(0xFF111111);
    const green = Color(0xFF0E7A3D);
    final scheme = ColorScheme.fromSeed(seedColor: green, brightness: Brightness.light, surface: Colors.white).copyWith(
      primary: ink,
      onPrimary: Colors.white,
      secondary: green,
      onSecondary: Colors.white,
      surface: Colors.white,
      surfaceContainerHighest: const Color(0xFFF1F1F1),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Fida Marketplace',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: Colors.white,
        fontFamilyFallback: const ['Roboto', 'Arial', 'sans-serif'],
        visualDensity: VisualDensity.standard,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: ink,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          surfaceTintColor: Colors.transparent,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF1F1F1),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: ink, width: 1.5)),
          labelStyle: const TextStyle(color: Colors.black54),
          hintStyle: const TextStyle(color: Colors.black45),
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          margin: EdgeInsets.zero,
          surfaceTintColor: Colors.transparent,
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: ink,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            textStyle: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: ink,
            side: const BorderSide(color: Color(0xFFD8D8D8)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        dividerTheme: const DividerThemeData(color: Color(0xFFEAEAEA), thickness: 1),
      ),
      home: AnimatedBuilder(
        animation: widget.session,
        builder: (context, _) {
          if (widget.session.initializing) return const _SplashScreen();
          if (!widget.session.isAuthenticated) return AuthScreen(session: widget.session);
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
            Container(
              width: 78,
              height: 78,
              decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(20)),
              alignment: Alignment.center,
              child: const Text('F', style: TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(height: 16),
            const Text('Fida Marketplace', style: TextStyle(fontSize: 27, fontWeight: FontWeight.w900, letterSpacing: -.8)),
            const SizedBox(height: 20),
            const SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2.5)),
          ],
        ),
      ),
    );
  }
}
