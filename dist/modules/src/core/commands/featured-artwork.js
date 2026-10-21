export function createFeaturedArtworkCommands(context) {
    return {
        feature: (id) => ({ id: 'view.artwork.feature', run: () => context.featureArtwork(id) }),
        restore: () => ({ id: 'view.artwork.restore', run: () => context.restoreBestMatch() }),
        select: (id) => ({ id: 'view.artwork.select', run: () => context.selectArtwork(id) }),
    };
}
//# sourceMappingURL=featured-artwork.js.map