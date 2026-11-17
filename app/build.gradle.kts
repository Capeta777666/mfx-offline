plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

android {
    namespace = "com.mfx.offline"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mfx.offline"
        minSdk = 33
        targetSdk = 36
        versionCode = 2
        versionName = "1.1"

        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }

    // Chave fixa: assim cada APK novo instala por cima do anterior (sem desinstalar)
    signingConfigs {
        create("mfx") {
            storeFile = file("mfx-offline.jks")
            storePassword = "mfxoffline"
            keyAlias = "mfx"
            keyPassword = "mfxoffline"
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("mfx")
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            useLegacyPackaging = true
            pickFirsts += listOf("**/libc++_shared.so", "**/libomp.so")
        }
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":lib"))

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.12.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.recyclerview:recyclerview:1.4.0")
    implementation("com.google.android.material:material:1.13.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    // Biblioteca offline do Kiwix (Wikipédia, guias médicos em arquivos .zim)
    implementation("org.kiwix:libkiwix:2.7.0")

    // Extrair texto limpo das páginas HTML
    implementation("org.jsoup:jsoup:1.21.2")
}
