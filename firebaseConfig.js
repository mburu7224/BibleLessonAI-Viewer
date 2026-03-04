// Frontend-local Firebase config.
// Keeping this file inside /frontend avoids cross-folder import path issues on static hosting.
export const firebaseConfig = {
  apiKey: "AIzaSyD_AnGX-RO7zfM_rCBopJmdv3BOVE4V-_o",
  authDomain: "media-app-a702b.firebaseapp.com",
  projectId: "media-app-a702b",
  storageBucket: "media-app-a702b.firebasestorage.app",
  messagingSenderId: "60484045851",
  appId: "1:60484045851:web:f1bb588c2d5edc177ffcbe",
  measurementId: "G-LPBXF7MLWF"
};

export const appSettings = {
  projectsCollection: "BibleLessonSlides",
  liveCollection: "BibleLessonSlides",
  defaultThemeId: 1,
  backendApiBaseUrl: "http://localhost:8787"
};
