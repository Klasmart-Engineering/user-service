docker_build('user-service-tilt', '.', 
    dockerfile='./Dockerfile')
k8s_yaml('./kubernetes/kidsloop-user-service-deployment.yaml')
k8s_yaml('./kubernetes/postgres1-deployment.yaml')

k8s_resource('kidsloop-user-service-deployment', labels=['user-service'], port_forwards=8080, resource_deps=['postgres1'])
k8s_resource('postgres1', labels=['user-service'], port_forwards=5432)

# appears to fix issues with not being able to communicate with local registry
# https://github.com/docker/for-mac/issues/3611
