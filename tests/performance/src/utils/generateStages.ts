export default function (stageAmount: number) {
    let i = 0;
    const stages = [];

    for (i; i < stageAmount; i++) {
        stages.push({
            duration: '30s',
            target: (i + 1) * 5,
        });
    }

    return stages;
}