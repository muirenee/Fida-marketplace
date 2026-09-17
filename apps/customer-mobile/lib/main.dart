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
    const fidaGreen = Color(0xFF176B55);
    const ink = Color(0xFF111111);
    final scheme = ColorScheme.fromSeed(
      seedColor: fidaGreen,
      brightness: Brightness.light,
      surface: Colors.white,
    ).copyWith(
      primary: ink,
      onPrimary: Colors.white,
      secondary: fidaGreen,
      onSecondary: Colors.white,
      surfaceContainerHighest: const Color(0xFFF2F3F2),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Fida Marketplace',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: Colors.white,
        fontFamilyFallback: const ['Roboto', 'Arial', 'sans-serif'],
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: ink,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF2F3F2),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: ink, width: 1.4),
          ),
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          margin: EdgeInsets.zero,
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: ink,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Colors.white,
          elevation: 2,
          indicatorColor: const Color(0xFFE2F3EC),
          labelTextStyle: WidgetStateProperty.resolveWith(
            (states) => TextStyle(
              fontWeight: states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
              color: ink,
            ),
          ),
        ),
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
            Container(
              width: 82,
              height: 82,
              decoration: BoxDecoration(
                color: const Color(0xFF176B55),
                borderRadius: BorderRadius.circular(22),
              ),
              alignment: Alignment.center,
              child: const Text('F', style: TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w900)),
            ),
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
