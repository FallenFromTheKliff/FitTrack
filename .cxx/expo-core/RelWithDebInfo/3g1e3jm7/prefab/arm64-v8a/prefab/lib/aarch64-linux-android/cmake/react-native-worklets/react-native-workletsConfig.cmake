if(NOT TARGET react-native-worklets::worklets)
add_library(react-native-worklets::worklets SHARED IMPORTED)
set_target_properties(react-native-worklets::worklets PROPERTIES
    IMPORTED_LOCATION "C:/FitTrack_rebuilt_20260330_212527/node_modules/.pnpm/react-n_cc5dcfc983295b0eda6c7c8194f36099/node_modules/react-native-worklets/android/build/intermediates/cxx/RelWithDebInfo/4wm4g186/obj/arm64-v8a/libworklets.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/FitTrack_rebuilt_20260330_212527/node_modules/.pnpm/react-n_cc5dcfc983295b0eda6c7c8194f36099/node_modules/react-native-worklets/android/build/prefab-headers/worklets"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

