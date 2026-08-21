if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/Users/HOUSTON/.gradle/caches/9.0.0/transforms/17b10e9e10d2424ccdc6bd1700ac9ef0/transformed/hermes-android-0.14.1-release/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/HOUSTON/.gradle/caches/9.0.0/transforms/17b10e9e10d2424ccdc6bd1700ac9ef0/transformed/hermes-android-0.14.1-release/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

