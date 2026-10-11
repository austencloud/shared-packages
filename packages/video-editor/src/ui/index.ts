export { default as VideoEditorSpike } from "./VideoEditorSpike.svelte";
export { provideEditorUi, useEditorUi, type EditorUi } from "./editor-context.js";
export { default as Popover } from "./kit/Popover.svelte";
export type {
	PostStudioShareExport,
	PostStudioShareExport as ShareExport,
} from "./share-export.js";
export {
	BOX_CORNERS,
	BOX_NUDGE,
	BOX_SIDES,
	BOX_SNAP_THRESHOLD,
	boxContains,
	type BoxField,
	type BoxGuides,
	type BoxHandle,
	boxTurn,
	dragBox,
	handleCursor,
	intoTurnedBox,
	NO_GUIDES,
	TURN_HANDLE_GAP,
	TURN_SNAP_DEGREES,
	TURN_STEP_DEGREES,
	turnBox,
	turnHandleSide,
	typeBox,
} from "./editor/post-box-drag.js";
export {
	cameraDisplayScale,
	cameraWindowCenter,
	clampToCoverage,
	clampToPanRange,
	coverZoom,
	CROP_CORNERS,
	CROP_SIDES,
	CROP_STAGE_MARGIN_PX,
	cropCamera,
	type CropCamera,
	type CropFit,
	type CropHandle,
	cropLimitFor,
	type CropPoint,
	type CropPose,
	cropPoseOf,
	type CropSize,
	cropStageRatio,
	cropWindowScale,
	fillPose,
	framePose,
	framingOfPose,
	handleFrame,
	handlePoint,
	handlePose,
	handleScaleAt,
	handleScaleRange,
	isCovered,
	joinRotation,
	movePose,
	overflowOf,
	overshootOf,
	quarterLeft,
	reshapePose,
	rubberBand,
	sameFraming,
	splitRotation,
	STRAIGHTEN_LIMIT,
	turnPose,
	withFit,
	zoomPoseAbout,
} from "./editor/post-crop-geometry.js";
export {
	boxPicture,
	frameGlideStart,
	glideStart,
	type StageFrame,
	stagePicture,
	type StagePicture,
	type StageTransform,
	transformOfStyle,
	transformPicture,
} from "./editor/post-crop-glide.js";
export {
	createCropSession,
	type CropSession,
	type CropShapeKind,
} from "./editor/post-crop-session.svelte.js";
export { adjacentStepSeconds, type ClipStep } from "./editor/post-crop-steps.js";
export {
	CURVE_EDITOR_Y_MAX,
	CURVE_EDITOR_Y_MIN,
	type CurvePlotGeometry,
	dataToPlotX,
	dataToPlotY,
	plotHeight,
	plotToDataX,
	plotToDataY,
	plotWidth,
} from "./editor/post-curve-plot.js";
export { newItemStart, overlayAt } from "./editor/post-editor-add.js";
export { readVideoFile, videoFileError } from "./editor/post-editor-files.js";
export {
	getPostEditorHeader,
	providePostEditorHeader,
} from "./editor/post-editor-header.svelte.js";
export {
	channelIcon,
	channelLabel,
	channelValueMeasure,
	channelValueText,
	easingPresetLabel,
	ITEM_KIND_ICON,
	itemDisplayLabel,
	itemIcon,
	itemKindLabel,
	toolIcon,
	toolLabel,
	translateKey,
} from "./editor/post-editor-labels.js";
export {
	availablePanels,
	coreToolRow,
	defaultPanel,
	isPanelTool,
	keyframeChannelFor,
	panelChannel,
	type PostPanelToolId,
	type PostToolId,
	type PostToolSelection,
	shownPanel,
	toolRow,
} from "./editor/post-editor-tools.js";
export {
	formatPostClock,
	formatPostSpeed,
	formatTakeClock,
	parseClock,
} from "./editor/post-format.js";
export { keepsShape, keptBox, shownBox } from "./editor/post-item-rect.js";
export {
	dragPicturePan,
	nudgePicturePan,
	overscanPixels,
	PICTURE_NUDGE,
	stepPicturePinch,
	zoomFromWheelDelta,
} from "./editor/post-picture-pan-drag.js";
export {
	dragSourceCrop,
	setSourceCropEdge,
	sourceCropAtRatio,
	type SourceCropHandle,
	sourceFillBox,
} from "./editor/post-source-crop.js";
export { dragSourceGeometry, scaleSourceGeometry } from "./editor/post-source-geometry.js";
export {
	autoScrollForPlayhead,
	clampPixelsPerSecond,
	fitPixelsPerSecond,
	type KeyLanesBand,
	mainTrackDropIndex,
	overlayRowAtPointerY,
	type OverlayRowHit,
	pixelsToSeconds,
	placeDraggedMusic,
	placeDraggedOverlay,
	POST_TIMELINE_DEFAULT_PIXELS_PER_SECOND,
	POST_TIMELINE_MAX_PIXELS_PER_SECOND,
	POST_TIMELINE_MIN_PIXELS_PER_SECOND,
	revealPlayheadScrollLeft,
	roundToFrameSeconds,
	rowsYWithoutKeyLanes,
	rulerTickInterval,
	scrollLeftForStableAnchor,
	secondsToPixels,
	snapToTargets,
} from "./editor/timeline/post-timeline-geometry.js";
export {
	selectTimelineItem,
	timelineGroupOf,
	timelineItemOrder,
	type TimelineSelection,
} from "./editor/timeline/post-timeline-selection.js";
export { loadPostProjectFonts } from "./editor/project-fonts.js";
