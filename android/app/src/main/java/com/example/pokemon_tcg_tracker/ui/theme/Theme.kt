package com.example.pokemon_tcg_tracker.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = Ember,
    secondary = Sand,
    tertiary = EmberDark,
    background = Cocoa,
    surface = Color(0xFF2A1D16),
    onPrimary = Ivory,
    onSecondary = Cocoa,
    onTertiary = Ivory,
    onBackground = Ivory,
    onSurface = Ivory
)

private val LightColorScheme = lightColorScheme(
    primary = EmberDark,
    secondary = Sand,
    tertiary = Ember,
    background = Cream,
    surface = Ivory,
    onPrimary = Ivory,
    onSecondary = Cocoa,
    onTertiary = Ivory,
    onBackground = Cocoa,
    onSurface = Cocoa
)

@Composable
fun Pokemon_tcg_trackerTheme(
    darkTheme: Boolean = false,
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
