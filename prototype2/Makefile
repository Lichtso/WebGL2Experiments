SRC_PATH = src/shader
BUILD_PATH = assets/shader_modules
SOURCES := $(wildcard $(SRC_PATH)/*)
TARGETS := $(SOURCES:$(SRC_PATH)/%.glsl=$(BUILD_PATH)/%.spv)

all: $(BUILD_PATH) $(TARGETS)

$(BUILD_PATH):
	mkdir -p $(BUILD_PATH)

$(BUILD_PATH)/%_vert.spv: src/shader/%_vert.glsl
	glslangValidator -S vert -V460 -o $@ $<

$(BUILD_PATH)/%_frag.spv: src/shader/%_frag.glsl
	glslangValidator -S frag -V460 -o $@ $<

$(BUILD_PATH)/%_comp.spv: src/shader/%_comp.glsl
	glslangValidator -S comp -V460 -o $@ $<
