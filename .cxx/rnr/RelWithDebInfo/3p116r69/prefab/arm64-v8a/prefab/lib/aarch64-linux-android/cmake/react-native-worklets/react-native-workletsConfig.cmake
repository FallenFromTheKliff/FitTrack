if(NOT TARGET react-native-worklets::worklets)
add_library(react-native-worklets::worklets SHARED IMPORTED)
set_target_properties(react-native-worklets::worklets PROPERTIES
    IMPORTED_LOCATION "C:/FitTrack/node_modules/.pnpm/react-n_640e7c95d80a533f1602ed4625ef3b4b/node_modules/react-native-worklets/android/build/intermediates/cxx/RelWithDebInfo/6p6r3v2x/obj/arm64-v8a/libworklets.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/FitTrack/node_modules/.pnpm/react-n_640e7c95d80a533f1602ed4625ef3b4b/node_modules/react-native-worklets/android/build/prefab-headers/worklets"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

